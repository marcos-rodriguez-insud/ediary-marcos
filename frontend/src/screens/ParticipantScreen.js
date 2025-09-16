import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, TouchableOpacity, Platform } from 'react-native';
import { Button } from '../components/Button';
import { API_BASE } from '../config';

export function ParticipantScreen({ onBack }) {
  const [code, setCode] = useState('');
  const [assignment, setAssignment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const visibleOrder = useMemo(() => {
    if (!assignment?.questions) {
      return [];
    }
    return computeVisibleOrder(assignment.questions, answers);
  }, [assignment, answers]);

  useEffect(() => {
    if (!visibleOrder.length) {
      setIndex(0);
      return;
    }
    if (index > visibleOrder.length - 1) {
      setIndex(visibleOrder.length - 1);
    }
  }, [visibleOrder, index]);

  const currentQuestionId = visibleOrder[index];
  const currentQuestion = assignment?.questions?.find((q) => q.id === currentQuestionId) || null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;

  const handleLoad = async () => {
    if (!code.trim()) {
      Alert.alert('Missing code', 'Enter your participant code to continue.');
      return;
    }
    setLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/user/questionnaires?participant_code=${encodeURIComponent(code.trim())}`);
      if (!res.ok) {
        setAssignment(null);
        setStatusMessage('Invalid code or failed to load assignments.');
        return;
      }
      const data = await res.json();
      if (!data.assignments?.length) {
        setAssignment(null);
        setStatusMessage('No active assignments found.');
        return;
      }
      const first = data.assignments[0];
      setAssignment(first);
      setAnswers({});
      setIndex(0);
      setStatusMessage('');
    } catch (err) {
      setStatusMessage('Failed to load assignment.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    if (index === 0) return;
    setIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = async () => {
    if (!currentQuestion) return;
    if (currentQuestion.required) {
      const value = answers[currentQuestion.id];
      const hasValue = Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '';
      if (!hasValue) {
        Alert.alert('Incomplete', 'Please answer this question.');
        return;
      }
    }
    if (index >= visibleOrder.length - 1) {
      await submitAnswers();
      return;
    }
    setIndex((prev) => Math.min(prev + 1, visibleOrder.length - 1));
  };

  const submitAnswers = async () => {
    if (!assignment) return;
    try {
      const res = await fetch(`${API_BASE}/api/user/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_code: code.trim(),
          questionnaire_id: assignment.questionnaire_id,
          answers
        })
      });
      if (!res.ok) {
        Alert.alert('Submission failed', 'Please try again.');
        return;
      }
      Alert.alert('Success', 'Thank you for completing the questionnaire.');
      setAssignment(null);
      setAnswers({});
      setIndex(0);
      setStatusMessage('Submission complete.');
    } catch (err) {
      Alert.alert('Submission failed', 'Please try again.');
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Button title="Back" variant="secondary" onPress={onBack} />
          <Text style={styles.title}>Participant</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>Participant Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your code"
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
          />
          <Button title={loading ? 'Loading…' : 'Load Questionnaire'} onPress={handleLoad} disabled={loading} />
          {statusMessage ? <Text style={styles.status}>{statusMessage}</Text> : null}
        </View>

        {assignment && currentQuestion ? (
          <View style={styles.panel}>
            <Text style={styles.assignmentTitle}>{assignment.name}</Text>
            {assignment.description ? <Text style={styles.description}>{assignment.description}</Text> : null}
            <Text style={styles.progress}>Question {index + 1} of {visibleOrder.length}</Text>
            <QuestionView question={currentQuestion} value={currentAnswer} onChange={(value) => handleAnswerChange(currentQuestion.id, value)} />
            <View style={styles.nav}>
              <Button title="Previous" variant="secondary" onPress={handlePrev} disabled={index === 0} />
              <Button title={index === visibleOrder.length - 1 ? 'Submit' : 'Next'} onPress={handleNext} />
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function computeVisibleOrder(questions, answers) {
  return questions
    .slice()
    .sort((a, b) => a.order - b.order)
    .filter((question) => shouldShowQuestion(question, questions, answers))
    .map((question) => question.id);
}

function shouldShowQuestion(question, allQuestions, answers) {
  const byText = (text) => {
    const match = allQuestions.find((q) => q.text === text);
    if (!match) return undefined;
    return answers[match.id];
  };

  const ringInserted = byText('Did you have the trial vaginal ring inserted today?');
  const expelled = byText('Did the ring come out (expulsion) today?');
  const sexual = byText('Sexual activity today?');
  const aesm = byText('Any new symptoms or adverse events today?') || [];
  const meds = byText('Did you take any new medications today?');

  if (question.text === 'If not inserted at any time, what was the reason?') {
    return ringInserted === 'no';
  }
  if (question.text === 'Approximate time of first insertion today') {
    return ringInserted === 'yes_continuous' || ringInserted === 'yes_reinserted';
  }
  if (question.text === 'If expelled, how long was it out?') {
    return expelled === 'partial' || expelled === 'complete';
  }
  if (question.text === 'If vaginal intercourse, was a condom used?') {
    return sexual === 'vaginal';
  }
  if (question.text === 'Discomfort during intercourse (if applicable)') {
    return sexual === 'vaginal';
  }
  if (question.text === 'If other symptoms/AEs, please describe') {
    return Array.isArray(aesm) && aesm.includes('other');
  }
  if (question.text === 'If yes, list medication(s) and dose') {
    return meds === 'yes';
  }
  return true;
}

function QuestionView({ question, value, onChange }) {
  if (!question) return null;
  switch (question.type) {
    case 'text':
    case 'date':
    case 'time':
      return (
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{renderLabel(question)}</Text>
          <TextInput
            style={styles.input}
            value={value ?? ''}
            onChangeText={onChange}
            placeholder="Enter answer"
          />
        </View>
      );
    case 'number':
      return (
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{renderLabel(question)}</Text>
          <TextInput
            style={styles.input}
            value={value !== null && value !== undefined ? String(value) : ''}
            onChangeText={(text) => onChange(text ? Number(text) : null)}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>
      );
    case 'single_choice':
    case 'likert':
      return (
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{renderLabel(question)}</Text>
          {question.choices?.map((choice) => (
            <ChoiceOption
              key={choice.value}
              label={choice.text}
              selected={value === choice.value}
              onPress={() => onChange(choice.value)}
            />
          ))}
        </View>
      );
    case 'multi_choice':
      return (
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{renderLabel(question)}</Text>
          {question.choices?.map((choice) => {
            const selectedValues = Array.isArray(value) ? value : [];
            const selected = selectedValues.includes(choice.value);
            return (
              <ChoiceOption
                key={choice.value}
                label={choice.text}
                selected={selected}
                onPress={() => {
                  const next = selected
                    ? selectedValues.filter((v) => v !== choice.value)
                    : [...selectedValues, choice.value];
                  onChange(next);
                }}
                multiple
              />
            );
          })}
        </View>
      );
    default:
      return (
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{renderLabel(question)}</Text>
          <TextInput style={styles.input} value={value ?? ''} onChangeText={onChange} />
        </View>
      );
  }
}

function renderLabel(question) {
  return `${question.text}${question.required ? ' *' : ''}`;
}

function ChoiceOption({ label, selected, onPress, multiple = false }) {
  return (
    <TouchableOpacity style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}>
      <View style={[styles.indicator, selected && (multiple ? styles.indicatorChecked : styles.indicatorSelected)]}>
        {multiple && selected ? <Text style={styles.indicatorMark}>✓</Text> : null}
      </View>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: '#f1f5f9',
    ...Platform.select({
      web: {
        alignItems: 'center',
      },
    }),
  },
  page: {
    width: '100%',
    gap: 24,
    ...Platform.select({
      web: {
        maxWidth: 760,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a'
  },
  panel: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    gap: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
    width: '100%',
    ...Platform.select({
      web: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
      },
    }),
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff'
  },
  status: {
    color: '#475569'
  },
  assignmentTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0f172a'
  },
  description: {
    color: '#475569'
  },
  progress: {
    color: '#475569',
    fontSize: 14
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  questionContainer: {
    gap: 12
  },
  questionText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#0f172a'
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10
  },
  choiceSelected: {
    borderColor: '#1f6feb',
    backgroundColor: '#e0eaff'
  },
  choiceLabel: {
    fontSize: 16,
    color: '#1e293b'
  },
  choiceLabelSelected: {
    color: '#0f172a',
    fontWeight: '600'
  },
  indicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  indicatorSelected: {
    backgroundColor: '#1f6feb',
    borderColor: '#1f6feb'
  },
  indicatorChecked: {
    backgroundColor: '#1f6feb',
    borderColor: '#1f6feb'
  },
  indicatorMark: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12
  }
});

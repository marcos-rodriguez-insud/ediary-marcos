import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, TouchableOpacity, Platform } from 'react-native';
import { Button } from '../components/Button';
import { API_BASE, withAdminHeaders } from '../config';

const roleOptions = ['participant', 'admin'];

export function AdminScreen({ adminKey, onAdminKeyChange, onBack }) {
  const [users, setUsers] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [userForm, setUserForm] = useState({ name: '', email: '', code: '', role: 'participant' });
  const [questionnaireForm, setQuestionnaireForm] = useState({ name: '', version: '1.0', description: '', questions: '' });
  const [assignmentForm, setAssignmentForm] = useState({ userId: '', questionnaireId: '' });

  const adminHeaders = useMemo(() => withAdminHeaders(adminKey), [adminKey]);

  const readJson = async (response) => {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      return { message: text };
    }
  };

  const request = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...adminHeaders,
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const payload = await readJson(res);
      const message = payload?.detail || payload?.message || `Request failed (${res.status})`;
      throw new Error(message);
    }
    if (res.status === 204) {
      return null;
    }
    return readJson(res);
  }, [adminHeaders]);

  const refreshData = useCallback(async () => {
    if (!adminKey) {
      setUsers([]);
      setQuestionnaires([]);
      setAssignments([]);
      setEntries([]);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const [usersData, questionnairesData, assignmentsData, entriesData] = await Promise.all([
        request('/api/admin/users'),
        request('/api/admin/questionnaires'),
        request('/api/admin/assignments'),
        request('/api/admin/entries')
      ]);
      setUsers(usersData || []);
      setQuestionnaires(questionnairesData || []);
      setAssignments(assignmentsData || []);
      setEntries(entriesData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [adminKey, request]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleCreateUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) {
      Alert.alert('Missing information', 'Name and email are required.');
      return;
    }
    try {
      await request('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          participant_code: userForm.code.trim() ? userForm.code.trim() : null,
          role: userForm.role
        })
      });
      setUserForm({ name: '', email: '', code: '', role: userForm.role });
      refreshData();
    } catch (err) {
      Alert.alert('Failed to create user', err.message);
    }
  };

  const handleCreateQuestionnaire = async () => {
    if (!questionnaireForm.name.trim()) {
      Alert.alert('Missing information', 'Questionnaire name is required.');
      return;
    }
    let parsedQuestions;
    if (questionnaireForm.questions.trim()) {
      try {
        parsedQuestions = JSON.parse(questionnaireForm.questions);
      } catch (err) {
        Alert.alert('Invalid JSON', 'Questions must be valid JSON.');
        return;
      }
    }
    try {
      await request('/api/admin/questionnaires', {
        method: 'POST',
        body: JSON.stringify({
          name: questionnaireForm.name.trim(),
          version: questionnaireForm.version.trim() || '1.0',
          description: questionnaireForm.description.trim(),
          is_active: true,
          questions: parsedQuestions
        })
      });
      setQuestionnaireForm({ name: '', version: '1.0', description: '', questions: '' });
      refreshData();
    } catch (err) {
      Alert.alert('Failed to create questionnaire', err.message);
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignmentForm.userId.trim() || !assignmentForm.questionnaireId.trim()) {
      Alert.alert('Missing information', 'User ID and Questionnaire ID are required.');
      return;
    }
    try {
      await request('/api/admin/assignments', {
        method: 'POST',
        body: JSON.stringify({
          user_id: Number(assignmentForm.userId),
          questionnaire_id: Number(assignmentForm.questionnaireId),
          active: true
        })
      });
      setAssignmentForm({ userId: '', questionnaireId: '' });
      refreshData();
    } catch (err) {
      Alert.alert('Failed to assign questionnaire', err.message);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await request(`/api/admin/assignments/${assignmentId}`, { method: 'DELETE' });
      refreshData();
    } catch (err) {
      Alert.alert('Failed to delete assignment', err.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Button title="Back" variant="secondary" onPress={onBack} />
          <Text style={styles.title}>Admin</Text>
        </View>

        <Text style={styles.helper}>Use your admin API key to manage users, questionnaires and assignments.</Text>
        <TextInput
          style={styles.input}
          placeholder="Admin API Key"
          value={adminKey}
          onChangeText={onAdminKeyChange}
          autoCapitalize="none"
        />
        <View style={styles.refreshRow}>
          <Button title={loading ? 'Refreshing…' : 'Refresh'} onPress={refreshData} disabled={loading} variant="secondary" />
          <Text style={styles.apiBase}>API: {API_BASE}</Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Users</Text>
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={userForm.name}
          onChangeText={(value) => setUserForm((prev) => ({ ...prev, name: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={userForm.email}
          onChangeText={(value) => setUserForm((prev) => ({ ...prev, email: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Participant Code"
          autoCapitalize="characters"
          value={userForm.code}
          onChangeText={(value) => setUserForm((prev) => ({ ...prev, code: value }))}
        />
        <View style={styles.toggleRow}>
          {roleOptions.map((roleOption) => {
            const active = userForm.role === roleOption;
            return (
              <TouchableOpacity
                key={roleOption}
                onPress={() => setUserForm((prev) => ({ ...prev, role: roleOption }))}
                style={[styles.toggle, active && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{roleOption}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Button title="Create User" onPress={handleCreateUser} />
        <View style={styles.list}>
          {users.map((user) => (
            <View key={user.id} style={styles.listRow}>
              <Text style={styles.listMain}>{user.name}</Text>
              <Text style={styles.listMeta}>{user.email}</Text>
              <Text style={styles.listMeta}>Code: {user.participant_code || 'n/a'}</Text>
              <Text style={styles.listMeta}>Role: {user.role}</Text>
            </View>
          ))}
          {!users.length && <Text style={styles.emptyText}>No users yet.</Text>}
        </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Questionnaires</Text>
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={questionnaireForm.name}
          onChangeText={(value) => setQuestionnaireForm((prev) => ({ ...prev, name: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Version"
          value={questionnaireForm.version}
          onChangeText={(value) => setQuestionnaireForm((prev) => ({ ...prev, version: value }))}
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Description"
          multiline
          value={questionnaireForm.description}
          onChangeText={(value) => setQuestionnaireForm((prev) => ({ ...prev, description: value }))}
        />
        <Text style={styles.helper}>Optional: paste questions JSON</Text>
        <TextInput
          style={[styles.input, styles.multiline, styles.codeInput]}
          placeholder='[{"text":"How do you feel?","type":"likert","choices":[{"text":"Bad","value":"1"}]}]'
          multiline
          value={questionnaireForm.questions}
          onChangeText={(value) => setQuestionnaireForm((prev) => ({ ...prev, questions: value }))}
        />
        <Button title="Create Questionnaire" onPress={handleCreateQuestionnaire} />
        <View style={styles.list}>
          {questionnaires.map((q) => (
            <View key={q.id} style={styles.listRow}>
              <Text style={styles.listMain}>{q.name}</Text>
              <Text style={styles.listMeta}>Version {q.version}</Text>
              <Text style={styles.listMeta}>Questions: {q.questions?.length ?? 0}</Text>
            </View>
          ))}
          {!questionnaires.length && <Text style={styles.emptyText}>No questionnaires yet.</Text>}
        </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Assignments</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            placeholder="User ID"
            keyboardType="numeric"
            value={assignmentForm.userId}
            onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, userId: value }))}
          />
          <TextInput
            style={[styles.input, styles.rowInput]}
            placeholder="Questionnaire ID"
            keyboardType="numeric"
            value={assignmentForm.questionnaireId}
            onChangeText={(value) => setAssignmentForm((prev) => ({ ...prev, questionnaireId: value }))}
          />
        </View>
        <Button title="Assign" onPress={handleCreateAssignment} />
        <View style={styles.list}>
          {assignments.map((assignment) => (
            <View key={assignment.id} style={styles.assignmentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listMain}>Assignment #{assignment.id}</Text>
                <Text style={styles.listMeta}>User: {assignment.user_id}</Text>
                <Text style={styles.listMeta}>Questionnaire: {assignment.questionnaire_id}</Text>
                <Text style={styles.listMeta}>Active: {String(assignment.active)}</Text>
              </View>
              <Button
                title="Delete"
                variant="secondary"
                onPress={() => handleDeleteAssignment(assignment.id)}
              />
            </View>
          ))}
          {!assignments.length && <Text style={styles.emptyText}>No assignments yet.</Text>}
        </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Entries</Text>
        <View style={styles.list}>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.listRow}>
              <Text style={styles.listMain}>Entry #{entry.id}</Text>
              <Text style={styles.listMeta}>User: {entry.user_id}</Text>
              <Text style={styles.listMeta}>Questionnaire: {entry.questionnaire_id}</Text>
              <Text style={styles.listMeta}>Submitted: {new Date(entry.submitted_at).toLocaleString()}</Text>
              <Text style={styles.code}>{JSON.stringify(entry.answers)}</Text>
            </View>
          ))}
          {!entries.length && <Text style={styles.emptyText}>No submissions yet.</Text>}
        </View>
        </View>
      </View>
    </ScrollView>
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
        maxWidth: 960,
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
  helper: {
    color: '#475569',
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    marginBottom: 12
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  codeInput: {
    fontFamily: 'Courier',
    fontSize: 13
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  apiBase: {
    color: '#64748b',
    marginLeft: 12
  },
  error: {
    color: '#dc2626',
    fontWeight: '600'
  },
  panel: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
    width: '100%',
    gap: 12,
    ...Platform.select({
      web: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
      },
    }),
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0f172a'
  },
  list: {
    marginTop: 12,
    gap: 12
  },
  listRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    gap: 4
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    gap: 12
  },
  listMain: {
    fontWeight: '600',
    color: '#0f172a'
  },
  listMeta: {
    color: '#475569',
    fontSize: 14
  },
  emptyText: {
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  rowInput: {
    flex: 1,
    marginBottom: 0
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    alignItems: 'center'
  },
  toggleActive: {
    backgroundColor: '#1f6feb'
  },
  toggleText: {
    color: '#475569',
    fontWeight: '500'
  },
  toggleTextActive: {
    color: '#ffffff'
  },
  code: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: '#0f172a'
  }
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Button } from '../components/Button';
import { API_BASE, withAdminHeaders } from '../config';

const roleOptions = ['participant', 'admin'];

const webFileInputStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  zIndex: 1,
};

export function AdminScreen({ adminKey, onAdminKeyChange, onBack }) {
  const [users, setUsers] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dropError, setDropError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [userForm, setUserForm] = useState({ name: '', email: '', code: '', role: 'participant' });
  const [questionnaireForm, setQuestionnaireForm] = useState({ name: '', version: '1.0', description: '', questions: '' });
  const [projectForm, setProjectForm] = useState({ name: '', description: '', adminKey: '' });
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedQuestionnaireIds, setSelectedQuestionnaireIds] = useState([]);

  const adminHeaders = useMemo(() => withAdminHeaders(adminKey), [adminKey]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const isWeb = Platform.OS === 'web';
  const dropZoneRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const refreshProjects = useCallback(async () => {
    if (!adminKey) {
      setProjects([]);
      setIsSuperAdmin(false);
      setSelectedProjectId(null);
      return;
    }
    try {
      const data = await request('/api/admin/projects');
      const list = data?.projects || [];
      setProjects(list);
      setIsSuperAdmin(Boolean(data?.is_super_admin));
      setSelectedProjectId((prev) => {
        if (prev && list.some((project) => project.id === prev)) {
          return prev;
        }
        return null;
      });
    } catch (err) {
      setError(err.message);
      setProjects([]);
      setIsSuperAdmin(false);
      setSelectedProjectId(null);
    }
  }, [adminKey, request]);

  const refreshData = useCallback(async () => {
    if (!adminKey || !selectedProjectId) {
      setUsers([]);
      setQuestionnaires([]);
      setAssignments([]);
      setEntries([]);
      setSelectedUserIds([]);
      setSelectedQuestionnaireIds([]);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const projectParam = `?project_id=${selectedProjectId}`;
      const [usersData, questionnairesData, assignmentsData, entriesData] = await Promise.all([
        request(`/api/admin/users${projectParam}`),
        request(`/api/admin/questionnaires${projectParam}`),
        request(`/api/admin/assignments${projectParam}`),
        request(`/api/admin/entries${projectParam}`)
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
  }, [adminKey, request, selectedProjectId]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setError('');
    setSelectedUserIds([]);
    setSelectedQuestionnaireIds([]);
  };

  const handleBackToProjects = () => {
    setSelectedProjectId(null);
    setUsers([]);
    setQuestionnaires([]);
    setAssignments([]);
    setEntries([]);
    setSelectedUserIds([]);
    setSelectedQuestionnaireIds([]);
  };

  const toggleUserSelection = useCallback((userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  const toggleQuestionnaireSelection = useCallback((questionnaireId) => {
    setSelectedQuestionnaireIds((prev) =>
      prev.includes(questionnaireId)
        ? prev.filter((id) => id !== questionnaireId)
        : [...prev, questionnaireId]
    );
  }, []);

  const handleCreateUser = async () => {
    if (!selectedProjectId) {
      Alert.alert('Select project', 'Choose or create a project first.');
      return;
    }
    if (!userForm.name.trim() || !userForm.email.trim()) {
      Alert.alert('Missing information', 'Name and email are required.');
      return;
    }
    try {
      await request('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          participant_code: userForm.code.trim() ? userForm.code.trim() : null,
          role: userForm.role,
          project_id: selectedProjectId
        })
      });
      setUserForm({ name: '', email: '', code: '', role: userForm.role });
      refreshData();
    } catch (err) {
      Alert.alert('Failed to create user', err.message);
    }
  };

  const handleCreateQuestionnaire = async () => {
    if (!selectedProjectId) {
      Alert.alert('Select project', 'Choose or create a project first.');
      return;
    }
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: questionnaireForm.name.trim(),
          version: questionnaireForm.version.trim() || '1.0',
          description: questionnaireForm.description.trim(),
          is_active: true,
          project_id: selectedProjectId,
          questions: parsedQuestions
        })
      });
      setQuestionnaireForm({ name: '', version: '1.0', description: '', questions: '' });
      setDropError('');
      refreshData();
    } catch (err) {
      Alert.alert('Failed to create questionnaire', err.message);
    }
  };

  const handleFileSelection = useCallback(
    async (event) => {
      if (!isWeb) {
        return;
      }
      const files = event.target?.files;
      if (!files || !files.length) {
        return;
      }
      const file = files[0];
      if (!file.name.toLowerCase().endsWith('.json')) {
        setDropError('Only JSON files are supported.');
        event.target.value = '';
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        let nextQuestions = text;
        const updates = {};

        if (Array.isArray(parsed)) {
          nextQuestions = JSON.stringify(parsed, null, 2);
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.name && !questionnaireForm.name) {
            updates.name = parsed.name;
          }
          if (parsed.version && questionnaireForm.version === '1.0') {
            updates.version = String(parsed.version);
          }
          if (parsed.description && !questionnaireForm.description) {
            updates.description = parsed.description;
          }
          if (Array.isArray(parsed.questions)) {
            nextQuestions = JSON.stringify(parsed.questions, null, 2);
          }
        }

        setQuestionnaireForm((prev) => ({ ...prev, ...updates, questions: nextQuestions }));
        setDropError('');
        setDragActive(false);
      } catch (err) {
        setDropError('Invalid JSON file.');
      } finally {
        event.target.value = '';
      }
    },
    [isWeb, questionnaireForm]
  );

  useEffect(() => {
    if (!isWeb) {
      return undefined;
    }
    const node = dropZoneRef.current;
    if (!node || typeof node.addEventListener !== 'function') {
      return undefined;
    }

    const handleDragEnter = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(true);
    };

    const handleDragOver = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(true);
    };

    const handleDragLeave = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
    };

    const handleDrop = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
    };

    node.addEventListener('dragenter', handleDragEnter);
    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('drop', handleDrop);

    return () => {
      node.removeEventListener('dragenter', handleDragEnter);
      node.removeEventListener('dragover', handleDragOver);
      node.removeEventListener('dragleave', handleDragLeave);
      node.removeEventListener('drop', handleDrop);
    };
  }, [isWeb]);

  const handleCreateAssignment = async () => {
    if (!selectedProjectId) {
      Alert.alert('Select project', 'Choose or create a project first.');
      return;
    }
    if (!selectedUserIds.length || !selectedQuestionnaireIds.length) {
      Alert.alert('Missing selection', 'Select at least one user and one questionnaire.');
      return;
    }
    try {
      setLoading(true);
      for (const userId of selectedUserIds) {
        for (const questionnaireId of selectedQuestionnaireIds) {
          await request('/api/admin/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userId,
              questionnaire_id: questionnaireId,
              active: true,
              project_id: selectedProjectId
            })
          });
        }
      }
      setSelectedUserIds([]);
      setSelectedQuestionnaireIds([]);
      refreshData();
    } catch (err) {
      Alert.alert('Failed to assign questionnaire', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!projectForm.name.trim()) {
      Alert.alert('Missing information', 'Project name is required.');
      return;
    }
    try {
      const payload = await request('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectForm.name.trim(),
          description: projectForm.description.trim() || null,
          admin_key: projectForm.adminKey.trim() || null
        })
      });
      setProjectForm({ name: '', description: '', adminKey: '' });
      await refreshProjects();
      if (payload?.admin_key) {
        Alert.alert('Project created', `Admin key: ${payload.admin_key}`);
      }
    } catch (err) {
      Alert.alert('Failed to create project', err.message);
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

  const projectRoleText = isSuperAdmin ? 'Role: Super Admin' : 'Role: Project Admin';
  const showProjectCreation = isSuperAdmin;
  const renderRefreshButton = () => (
    <Button
      title={loading ? 'Refreshing…' : selectedProjectId ? 'Refresh Project Data' : 'Refresh Projects'}
      onPress={selectedProjectId ? refreshData : refreshProjects}
      disabled={loading || !adminKey}
      variant="secondary"
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Button title="Back" variant="secondary" onPress={onBack} />
          <Text style={styles.title}>Admin</Text>
        </View>

        <Text style={styles.helper}>Use your admin API key to manage projects and their data.</Text>
        <TextInput
          style={styles.input}
          placeholder="Admin API Key"
          value={adminKey}
          onChangeText={(value) => {
            onAdminKeyChange(value);
            setError('');
          }}
          autoCapitalize="none"
        />
        <View style={styles.refreshRow}>
          {renderRefreshButton()}
          <View style={styles.refreshMeta}>
            <Text style={styles.apiBase}>API: {API_BASE}</Text>
            <Text style={styles.projectMeta}>{projectRoleText}</Text>
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!selectedProject ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Projects</Text>
            {projects.length ? (
              <View style={styles.projectGrid}>
                {projects.map((project) => {
                  const active = project.id === selectedProjectId;
                  return (
                    <TouchableOpacity
                      key={project.id}
                      style={[styles.projectCard, active && styles.projectCardActive]}
                      onPress={() => handleSelectProject(project.id)}
                    >
                      <Text style={styles.projectName}>{project.name}</Text>
                      {project.description ? <Text style={styles.projectDescription}>{project.description}</Text> : null}
                      {isSuperAdmin && project.admin_key ? (
                        <Text style={styles.projectAdminKey}>Admin key: {project.admin_key}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>No accessible projects. Create one or ask a super admin for access.</Text>
            )}

            {showProjectCreation ? (
              <View style={styles.projectForm}>
                <Text style={styles.panelSubtitle}>Create Project</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Project name"
                  value={projectForm.name}
                  onChangeText={(value) => setProjectForm((prev) => ({ ...prev, name: value }))}
                />
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Description (optional)"
                  multiline
                  value={projectForm.description}
                  onChangeText={(value) => setProjectForm((prev) => ({ ...prev, description: value }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Admin key (leave blank to auto-generate)"
                  value={projectForm.adminKey}
                  onChangeText={(value) => setProjectForm((prev) => ({ ...prev, adminKey: value }))}
                />
                <Button title="Create Project" onPress={handleCreateProject} disabled={!projectForm.name.trim()} />
              </View>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.panel}>
              <View style={styles.projectHeader}>
                <Button title="Back to Projects" variant="secondary" onPress={handleBackToProjects} />
                <View style={styles.projectHeaderDetails}>
                  <Text style={styles.projectSelectedName}>{selectedProject.name}</Text>
                  {selectedProject.description ? (
                    <Text style={styles.projectSelectedDescription}>{selectedProject.description}</Text>
                  ) : null}
                  {isSuperAdmin && selectedProject.admin_key ? (
                    <Text style={styles.projectAdminKey}>Admin key: {selectedProject.admin_key}</Text>
                  ) : null}
                </View>
              </View>
            </View>

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
              <Button title="Create User" onPress={handleCreateUser} disabled={!selectedProjectId} />
              <View style={styles.list}>
                {users.map((user) => {
                  const active = selectedUserIds.includes(user.id);
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={[styles.listRow, active && styles.selectableActive]}
                      onPress={() => toggleUserSelection(user.id)}
                    >
                      <Text style={styles.listMain}>{user.name}</Text>
                      <Text style={styles.listMeta}>{user.email}</Text>
                      <Text style={styles.listMeta}>Code: {user.participant_code || 'n/a'}</Text>
                      <Text style={styles.listMeta}>Role: {user.role}</Text>
                    </TouchableOpacity>
                  );
                })}
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
              <View
                ref={isWeb ? dropZoneRef : undefined}
                style={[styles.dropZone, dragActive && styles.dropZoneActive]}
                {...(isWeb ? { onClick: () => fileInputRef.current?.click() } : {})}
              >
                <Text style={styles.dropZoneText}>
                  {isWeb ? 'Drag & drop a questionnaire JSON file here' : 'Upload questionnaire JSON manually below'}
                </Text>
                {questionnaireForm.questions ? (
                  <Text style={styles.dropZoneHint}>File loaded. You can review or edit the JSON below.</Text>
                ) : (
                  <Text style={styles.dropZoneHint}>The JSON will populate the text area.
                  </Text>
                )}
                {isWeb ? (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,application/JSON,.json"
                    style={webFileInputStyle}
                    onChange={handleFileSelection}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : null}
              </View>
              {dropError ? <Text style={styles.error}>{dropError}</Text> : null}
              <TextInput
                style={[styles.input, styles.multiline, styles.codeInput]}
                placeholder='[{"text":"How do you feel?","type":"likert","choices":[{"text":"Bad","value":"1"}]}]'
                multiline
                value={questionnaireForm.questions}
                onChangeText={(value) => setQuestionnaireForm((prev) => ({ ...prev, questions: value }))}
              />
              <Button title="Create Questionnaire" onPress={handleCreateQuestionnaire} disabled={!selectedProjectId} />
              <View style={styles.list}>
                {questionnaires.map((q) => {
                  const active = selectedQuestionnaireIds.includes(q.id);
                  return (
                    <TouchableOpacity
                      key={q.id}
                      style={[styles.listRow, active && styles.selectableActive]}
                      onPress={() => toggleQuestionnaireSelection(q.id)}
                    >
                      <Text style={styles.listMain}>{q.name}</Text>
                      <Text style={styles.listMeta}>Version {q.version}</Text>
                      <Text style={styles.listMeta}>Questions: {q.questions?.length ?? 0}</Text>
                      {q.assignment_key ? (
                        <Text style={styles.listMeta}>Assignment Key: {q.assignment_key}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                {!questionnaires.length && <Text style={styles.emptyText}>No questionnaires yet.</Text>}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Assignments</Text>
              <Text style={styles.helper}>
                Select one or more users and questionnaires above, then click Assign Selected to create pairings.
              </Text>
              <View style={styles.assignmentSummary}>
                <Text style={styles.assignmentSummaryText}>Users selected: {selectedUserIds.length}</Text>
                <Text style={styles.assignmentSummaryText}>
                  Questionnaires selected: {selectedQuestionnaireIds.length}
                </Text>
              </View>
              <Button
                title={loading ? 'Assigning…' : 'Assign Selected'}
                onPress={handleCreateAssignment}
                disabled={
                  loading ||
                  !selectedProjectId ||
                  !selectedUserIds.length ||
                  !selectedQuestionnaireIds.length
                }
              />
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
          </>
        )}
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
  refreshMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  apiBase: {
    color: '#64748b',
    marginLeft: 12
  },
  projectMeta: {
    color: '#0f172a',
    fontWeight: '600',
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
  panelSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  projectGrid: {
    flexDirection: 'column',
    gap: 12,
    ...Platform.select({
      web: {
        flexDirection: 'row',
        flexWrap: 'wrap',
      },
    }),
  },
  projectCard: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 6,
    width: '100%',
    ...Platform.select({
      web: {
        width: '48%',
      },
    }),
  },
  projectCardActive: {
    borderColor: '#1f6feb',
    backgroundColor: '#e0eaff',
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  projectDescription: {
    color: '#475569',
  },
  projectAdminKey: {
    marginTop: 4,
    fontSize: 12,
    color: '#1f2937',
    fontFamily: 'Courier',
  },
  projectForm: {
    marginTop: 12,
    gap: 12,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  projectHeaderDetails: {
    flex: 1,
    gap: 6,
  },
  projectSelectedName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  projectSelectedDescription: {
    color: '#475569',
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
  selectableActive: {
    borderColor: '#1f6feb',
    backgroundColor: '#e0eaff',
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
  assignmentSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assignmentSummaryText: {
    fontWeight: '600',
    color: '#0f172a',
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
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    position: 'relative',
    ...Platform.select({
      web: {
        pointerEvents: 'auto',
      },
    }),
  },
  dropZoneActive: {
    borderColor: '#1f6feb',
    backgroundColor: '#e0eaff',
  },
  dropZoneText: {
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  dropZoneHint: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
  },
  code: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: '#0f172a'
  }
});

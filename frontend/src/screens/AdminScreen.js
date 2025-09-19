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
import DateTimePicker from '@react-native-community/datetimepicker';
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

const webDateInputStyle = {
  border: '1px solid #cbd5f5',
  borderRadius: 8,
  padding: '12px',
  width: '100%',
  fontSize: 16,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const formatDateForInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDateForDisplay = (date) =>
  `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

export function AdminScreen({ adminKey, onAdminKeyChange, onBack }) {
  const [users, setUsers] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
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
  const [taskForm, setTaskForm] = useState({
    userId: '',
    questionnaireId: '',
    title: '',
    description: '',
    type: 'reminder',
    dueAt: '',
    reminderMinutes: '',
  });
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [dueDate, setDueDate] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showQuestionnaireForm, setShowQuestionnaireForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [activeSection, setActiveSection] = useState('users');

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const sectionLabels = {
    overview: 'Overview',
    users: 'Users',
    questionnaires: 'Questionnaires',
    assignments: 'Assignments',
    tasks: 'Tasks',
    entries: 'Entries',
  };
  const sections = useMemo(() => (
    selectedProject ? ['users', 'questionnaires', 'assignments', 'tasks', 'entries'] : []
  ), [selectedProject]);
  const adminHeaders = useMemo(() => withAdminHeaders(adminKey), [adminKey]);
  const resetFormToggles = useCallback(() => {
    setShowProjectForm(false);
    setShowUserForm(false);
    setShowQuestionnaireForm(false);
    setShowAssignmentForm(false);
    setShowTaskForm(false);
    setShowDuePicker(false);
  }, []);
  const handleSectionSelect = useCallback((section) => {
    setActiveSection(section);
    resetFormToggles();
  }, [resetFormToggles]);
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
      setUsers([]);
      setQuestionnaires([]);
      setAssignments([]);
      setEntries([]);
      setTasks([]);
      setDueDate(null);
      setShowDuePicker(false);
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
      setUsers([]);
      setQuestionnaires([]);
      setAssignments([]);
      setEntries([]);
      setTasks([]);
      setDueDate(null);
      setShowDuePicker(false);
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
      setTasks([]);
      setDueDate(null);
      setShowDuePicker(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const projectParam = `?project_id=${selectedProjectId}`;
      const [usersData, questionnairesData, assignmentsData, entriesData, tasksData] = await Promise.all([
        request(`/api/admin/users${projectParam}`),
        request(`/api/admin/questionnaires${projectParam}`),
        request(`/api/admin/assignments${projectParam}`),
        request(`/api/admin/entries${projectParam}`),
        request(`/api/admin/tasks${projectParam}`)
      ]);
      setUsers(usersData || []);
      setQuestionnaires(questionnairesData || []);
      setAssignments(assignmentsData || []);
      setEntries(entriesData || []);
      setTasks(tasksData || []);
    } catch (err) {
      setError(err.message);
      setUsers([]);
      setQuestionnaires([]);
      setAssignments([]);
      setEntries([]);
      setTasks([]);
      setDueDate(null);
      setShowDuePicker(false);
    } finally {
      setLoading(false);
    }
  }, [adminKey, request, selectedProjectId]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    if (!sections.length) {
      return;
    }
    if (!sections.includes(activeSection)) {
      setActiveSection(sections[0]);
      resetFormToggles();
    }
  }, [sections, activeSection, resetFormToggles]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setError('');
    setSelectedUserIds([]);
    setSelectedQuestionnaireIds([]);
    setDueDate(null);
    setActiveSection('overview');
    resetFormToggles();
  };

  const handleBackToProjects = () => {
    setSelectedProjectId(null);
    setUsers([]);
    setQuestionnaires([]);
    setAssignments([]);
    setEntries([]);
    setTasks([]);
    setSelectedUserIds([]);
    setSelectedQuestionnaireIds([]);
    setDueDate(null);
    setActiveSection('overview');
    resetFormToggles();
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
      setShowUserForm(false);
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
      setShowQuestionnaireForm(false);
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
      setShowAssignmentForm(false);
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
      setShowProjectForm(false);
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

  const handleCreateTask = async () => {
    if (!selectedProjectId) {
      Alert.alert('Select project', 'Choose or create a project first.');
      return;
    }
    if (!taskForm.userId.trim()) {
      Alert.alert('Missing information', 'Select a user for the task.');
      return;
    }
    if (Number.isNaN(Number(taskForm.userId))) {
      Alert.alert('Invalid user', 'User ID must be numeric.');
      return;
    }
    if (!taskForm.title.trim()) {
      Alert.alert('Missing information', 'Task title is required.');
      return;
    }
    if (taskForm.questionnaireId.trim() && Number.isNaN(Number(taskForm.questionnaireId))) {
      Alert.alert('Invalid questionnaire', 'Questionnaire ID must be numeric.');
      return;
    }
    let dueAtIso = null;
    if (taskForm.dueAt.trim()) {
      const parsedDue = new Date(taskForm.dueAt);
      if (Number.isNaN(parsedDue.getTime())) {
        Alert.alert('Invalid date', 'Enter a valid due date/time.');
        return;
      }
      dueAtIso = parsedDue.toISOString();
    }

    let reminderMinutes = null;
    if (taskForm.reminderMinutes.trim()) {
      const parsedReminder = Number(taskForm.reminderMinutes);
      if (Number.isNaN(parsedReminder)) {
        Alert.alert('Invalid reminder', 'Reminder minutes must be numeric.');
        return;
      }
      reminderMinutes = parsedReminder;
    }

    const payload = {
      project_id: selectedProjectId,
      user_id: Number(taskForm.userId),
      questionnaire_id: taskForm.questionnaireId.trim() ? Number(taskForm.questionnaireId) : null,
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      task_type: taskForm.type,
      due_at: dueAtIso,
      reminder_minutes_before: reminderMinutes,
    };

    try {
      await request('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setTaskForm({ userId: '', questionnaireId: '', title: '', description: '', type: taskForm.type, dueAt: '', reminderMinutes: '' });
      setShowDuePicker(false);
      setDueDate(null);
      setShowTaskForm(false);
      refreshData();
    } catch (err) {
      Alert.alert('Failed to create task', err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await request(`/api/admin/tasks/${taskId}`, { method: 'DELETE' });
      refreshData();
    } catch (err) {
      Alert.alert('Failed to delete task', err.message);
    }
  };

  const taskTypeOptions = ['fill_form', 'reminder'];
  const renderProjectHeader = () => {
    if (!selectedProject) {
      return null;
    }
    return (
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
    );
  };

    const renderOverviewContent = () => {
    if (!selectedProject) {
      return null;
    }
    const summary = [
      { label: 'Users', value: users.length },
      { label: 'Questionnaires', value: questionnaires.length },
      { label: 'Assignments', value: assignments.length },
      { label: 'Tasks', value: tasks.length },
      { label: 'Entries', value: entries.length },
    ];
    return (
      <View style={styles.panel}>
        <Text style={styles.panelSubtitle}>Project Overview</Text>
        <View style={styles.overviewGrid}>
          {summary.map((item) => (
            <View key={item.label} style={styles.overviewCard}>
              <Text style={styles.listMain}>{item.value}</Text>
              <Text style={styles.listMeta}>{item.label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.helper}>Use the navigation to manage project resources.</Text>
      </View>
    );
  };

const renderProjectsContent = (showFormButton = false) => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, styles.panelTitleInline]}>Projects</Text>
        {showProjectCreation && showFormButton ? (
          <Button
            title={showProjectForm ? 'Hide Form' : 'Create New Project'}
            variant="secondary"
            onPress={() => setShowProjectForm((prev) => !prev)}
          />
        ) : null}
      </View>
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

      {showProjectCreation && showProjectForm ? (
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
          <View style={styles.formButtonRow}>
            <Button title="Create Project" onPress={handleCreateProject} disabled={!projectForm.name.trim()} />
            <Button title="Cancel" variant="secondary" onPress={() => setShowProjectForm(false)} />
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderUsersContent = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, styles.panelTitleInline]}>Users</Text>
        <Button
          title={showUserForm ? 'Hide Form' : 'New User'}
          variant="secondary"
          onPress={() => setShowUserForm((prev) => !prev)}
        />
      </View>
      {showUserForm ? (
        <View style={styles.formSection}>
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
          <View style={styles.formButtonRow}>
            <Button title="Create User" onPress={handleCreateUser} disabled={!selectedProjectId} />
            <Button title="Cancel" variant="secondary" onPress={() => setShowUserForm(false)} />
          </View>
        </View>
      ) : null}
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
  );

  const renderQuestionnairesContent = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, styles.panelTitleInline]}>Questionnaires</Text>
        <Button
          title={showQuestionnaireForm ? 'Hide Form' : 'New Questionnaire'}
          variant="secondary"
          onPress={() => setShowQuestionnaireForm((prev) => !prev)}
        />
      </View>
      {showQuestionnaireForm ? (
        <View style={styles.formSection}>
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
              <Text style={styles.dropZoneHint}>The JSON will populate the text area.</Text>
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
          <View style={styles.formButtonRow}>
            <Button title="Create Questionnaire" onPress={handleCreateQuestionnaire} disabled={!selectedProjectId} />
            <Button title="Cancel" variant="secondary" onPress={() => setShowQuestionnaireForm(false)} />
          </View>
        </View>
      ) : null}
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
  );

  const renderAssignmentsContent = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, styles.panelTitleInline]}>Assignments</Text>
        <Button
          title={showAssignmentForm ? 'Hide Form' : 'Manage Assignments'}
          variant="secondary"
          onPress={() => setShowAssignmentForm((prev) => !prev)}
        />
      </View>
      {showAssignmentForm ? (
        <View style={styles.formSection}>
          <Text style={styles.helper}>
            Select one or more users and questionnaires above, then click Assign Selected to create pairings.
          </Text>
          <View style={styles.assignmentSummary}>
            <Text style={styles.assignmentSummaryText}>Users selected: {selectedUserIds.length}</Text>
            <Text style={styles.assignmentSummaryText}>
              Questionnaires selected: {selectedQuestionnaireIds.length}
            </Text>
          </View>
          <View style={styles.formButtonRow}>
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
            <Button title="Cancel" variant="secondary" onPress={() => setShowAssignmentForm(false)} />
          </View>
        </View>
      ) : null}
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
  );

  const renderTasksContent = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, styles.panelTitleInline]}>Tasks</Text>
        <Button
          title={showTaskForm ? 'Hide Form' : 'New Task'}
          variant="secondary"
          onPress={() => {
            if (showTaskForm) {
              setShowDuePicker(false);
            }
            setShowTaskForm((prev) => !prev);
          }}
        />
      </View>
      {showTaskForm ? (
        <View style={styles.formSection}>
          <Text style={styles.helper}>Create reminders or questionnaire tasks for individual users.</Text>
          <TextInput
            style={styles.input}
            placeholder="User ID"
            keyboardType="numeric"
            value={taskForm.userId}
            onChangeText={(value) => setTaskForm((prev) => ({ ...prev, userId: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Questionnaire ID (optional)"
            keyboardType="numeric"
            value={taskForm.questionnaireId}
            onChangeText={(value) => setTaskForm((prev) => ({ ...prev, questionnaireId: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Task title"
            value={taskForm.title}
            onChangeText={(value) => setTaskForm((prev) => ({ ...prev, title: value }))}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Description (optional)"
            multiline
            value={taskForm.description}
            onChangeText={(value) => setTaskForm((prev) => ({ ...prev, description: value }))}
          />
          <View style={styles.toggleRow}>
            {taskTypeOptions.map((taskType) => {
              const active = taskForm.type === taskType;
              return (
                <TouchableOpacity
                  key={taskType}
                  onPress={() => setTaskForm((prev) => ({ ...prev, type: taskType }))}
                  style={[styles.toggle, active && styles.toggleActive]}
                >
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{taskType.replace('_', ' ')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {isWeb ? (
            <input
              type="datetime-local"
              value={taskForm.dueAt}
              onChange={(event) => handleDueInputChange(event.target.value)}
              style={webDateInputStyle}
            />
          ) : (
            <View>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDuePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {dueDate
                    ? formatDateForDisplay(dueDate)
                    : 'Select due date/time (optional)'}
                </Text>
              </TouchableOpacity>
              {showDuePicker && (
                <DateTimePicker
                  value={dueDate || new Date()}
                  mode="datetime"
                  display="default"
                  onChange={handleDuePickerChange}
                />
              )}
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="Reminder minutes before (optional)"
            keyboardType="numeric"
            value={taskForm.reminderMinutes}
            onChangeText={(value) => setTaskForm((prev) => ({ ...prev, reminderMinutes: value }))}
          />
          <View style={styles.formButtonRow}>
            <Button
              title="Create Task"
              onPress={handleCreateTask}
              disabled={!selectedProjectId || !taskForm.userId.trim() || !taskForm.title.trim()}
            />
            <Button title="Cancel" variant="secondary" onPress={() => { setShowTaskForm(false); setShowDuePicker(false); }} />
          </View>
        </View>
      ) : null}
      <View style={styles.list}>
        {tasks.map((task) => {
          const questionnaireLabel = task.questionnaire_name || task.questionnaire_id;
          return (
            <View key={task.id} style={styles.taskRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.listMain}>{task.title}</Text>
                <Text style={styles.listMeta}>User: {task.user_id}</Text>
                {questionnaireLabel ? (
                  <Text style={styles.listMeta}>Questionnaire: {questionnaireLabel}</Text>
                ) : null}
                <Text style={styles.taskTypeBadge}>{task.task_type.replace('_', ' ')}</Text>
                {task.due_at ? (
                  <Text style={styles.listMeta}>
                    Due: {new Date(task.due_at).toLocaleString()}
                  </Text>
                ) : null}
                {task.reminder_minutes_before ? (
                  <Text style={styles.listMeta}>
                    Reminder: {task.reminder_minutes_before} min before
                  </Text>
                ) : null}
              </View>
              <Button
                title="Delete"
                variant="secondary"
                onPress={() => handleDeleteTask(task.id)}
              />
            </View>
          );
        })}
        {!tasks.length && <Text style={styles.emptyText}>No tasks yet.</Text>}
      </View>
    </View>
  );

  const renderEntriesContent = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, styles.panelTitleInline]}>Entries</Text>
      </View>
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
  );
  const handleDueInputChange = useCallback((value) => {
    setTaskForm((prev) => ({ ...prev, dueAt: value }));
    setDueDate(value ? new Date(value) : null);
  }, []);

  const handleDuePickerChange = useCallback((event, selectedDate) => {
    setShowDuePicker(false);
    if (event?.type === 'dismissed' || !selectedDate) {
      return;
    }
    setDueDate(selectedDate);
    setTaskForm((prev) => ({ ...prev, dueAt: formatDateForInput(selectedDate) }));
  }, []);

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
          renderProjectsContent(true)
        ) : (
          <>
            {renderProjectHeader()}
            <View style={styles.navBar}>
              {sections.map((section) => {
                const active = activeSection === section;
                return (
                  <TouchableOpacity
                    key={section}
                    style={[styles.navButton, active && styles.navButtonActive]}
                    onPress={() => handleSectionSelect(section)}
                  >
                    <Text style={[styles.navButtonText, active && styles.navButtonTextActive]}>
                      {sectionLabels[section]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.sectionContent}>
              {activeSection === 'users' && renderUsersContent()}
              {activeSection === 'questionnaires' && renderQuestionnairesContent()}
              {activeSection === 'assignments' && renderAssignmentsContent()}
              {activeSection === 'tasks' && renderTasksContent()}
              {activeSection === 'entries' && renderEntriesContent()}
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
    borderRadius: 16,
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
  navBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
  },
  sectionContent: {
    gap: 16,
    width: '100%',
  },
  navButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#d0d7de',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionDuration: '150ms',
      },
    }),
  },
  navButtonActive: {
    backgroundColor: '#1f6feb',
    borderColor: '#1f6feb',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  navButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  navButtonTextActive: {
    color: '#ffffff',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0f172a'
  },
  panelTitleInline: {
    marginBottom: 0,
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
  formSection: {
    gap: 12,
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
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
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  listMain: {
    fontWeight: '600',
    color: '#0f172a'
  },
  listMeta: {
    color: '#475569',
    fontSize: 14
  },
  taskTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e0eaff',
    color: '#1f6feb',
    fontSize: 12,
    textTransform: 'capitalize',
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
  dateButton: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  dateButtonText: {
    color: '#0f172a',
  },
  code: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: '#0f172a'
  }
});

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import type { TaskAssignment } from '../lib/types';
import { updateProjectActualCost } from '../lib/projectCosts';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';

interface TaskAssignmentManagerProps {
  onClose?: () => void;
  onAssignmentCreated?: () => void;
}

import type { StaffMember } from '../lib/types';

interface Project {
  id: string;
  name: string;
}

interface ProjectTask {
  id: string;
  title: string;
  status: string;
}

const TaskAssignmentManager: React.FC<TaskAssignmentManagerProps> = ({ onClose, onAssignmentCreated }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskDescription, setTaskDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [multiTaskMode, setMultiTaskMode] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAssignments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load staff members
      const staffSnapshot = await getDocs(collection(db, 'staffMembers'));
      const staffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StaffMember));
      setStaff(staffData);

      // Load projects
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      const projectsData = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'Unnamed Project'
      }));
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      const assignmentsQuery = query(
        collection(db, 'taskAssignments'),
        where('date', '==', selectedDate)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentsData = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaskAssignment[];
      setAssignments(assignmentsData);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const loadProjectTasks = async (projectId: string) => {
    if (!projectId) {
      setProjectTasks([]);
      return;
    }

    setLoadingTasks(true);
    try {
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || 'Untitled Task',
        status: doc.data().status || 'todo'
      }));
      setProjectTasks(tasksData);
    } catch (error) {
      console.error('Error loading project tasks:', error);
      setProjectTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Load tasks when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadProjectTasks(selectedProjectId);
      setSelectedTaskId('');
      setTaskDescription('');
    } else {
      setProjectTasks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const handleAssign = async () => {
    if (!currentUser) return;

    const staffIds = bulkMode ? selectedStaffIds : [selectedStaffId];
    
    // Get task IDs to assign
    let taskIdsToAssign: string[] = [];
    let taskDescriptions: Array<{ taskId?: string; description: string }> = [];
    
    if (multiTaskMode) {
      // Multiple tasks selected
      if (selectedTaskIds.length === 0) {
        alert('Please select at least one task');
        return;
      }
      taskIdsToAssign = selectedTaskIds;
      taskDescriptions = selectedTaskIds.map(taskId => {
        if (taskId === 'custom') {
          return { taskId: undefined, description: taskDescription.trim() };
        } else {
          const task = projectTasks.find(t => t.id === taskId);
          return { taskId, description: task?.title || 'Unknown Task' };
        }
      });
    } else {
      // Single task
      let finalTaskDescription = taskDescription.trim();
      let finalTaskId: string | undefined = undefined;
      
      if (selectedTaskId && selectedTaskId !== 'custom') {
        const selectedTask = projectTasks.find(t => t.id === selectedTaskId);
        finalTaskDescription = selectedTask?.title || taskDescription.trim();
        finalTaskId = selectedTaskId;
      }
      
      if (!finalTaskDescription) {
        alert('Please select a task or enter a description');
        return;
      }
      
      taskDescriptions = [{ taskId: finalTaskId, description: finalTaskDescription }];
    }
    
    if (staffIds.length === 0 || !selectedProjectId) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const project = projects.find(p => p.id === selectedProjectId);
      let assignmentCount = 0;
      
      for (const staffId of staffIds) {
        const staffMember = staff.find(s => s.id === staffId);
        if (!staffMember) continue;

        // Create one assignment per task for this staff member
        for (const taskInfo of taskDescriptions) {
          await addDoc(collection(db, 'taskAssignments'), {
            projectId: selectedProjectId,
            projectName: project?.name || 'Unknown Project',
            staffId: staffMember.id,
            staffName: staffMember.name,
            taskDescription: taskInfo.description,
            taskId: taskInfo.taskId,
            date: selectedDate,
            dailyRate: staffMember.dailyRate || 0,
            notes: notes.trim() || '',
            createdBy: currentUser.uid,
            createdAt: serverTimestamp()
          });
          assignmentCount++;
        }
      }

      // Update project actual cost
      await updateProjectActualCost(selectedProjectId);
      
      // Reset form
      setSelectedStaffId('');
      setSelectedStaffIds([]);
      setSelectedTaskId('');
      setSelectedTaskIds([]);
      setTaskDescription('');
      setNotes('');
      // Don't reset project so user can assign multiple tasks to same project
      
      // Reload assignments to show updated list
      await loadAssignments();
      
      // Notify parent component to refresh stats immediately
      if (onAssignmentCreated) {
        onAssignmentCreated();
      }
      
      // Show success message without blocking
      const totalCost = assignmentCount * (staff.find(s => s.id === staffIds[0])?.dailyRate || 0);
      alert(`✓ Successfully created ${assignmentCount} assignment(s)\n${staffIds.length} staff × ${taskDescriptions.length} task(s)\nTotal cost: $${totalCost.toFixed(2)}`);
    } catch (error) {
      console.error('Error creating assignment:', error);
      alert('Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      // Get the assignment to find its projectId before deleting
      const assignment = assignments.find(a => a.id === assignmentId);
      const projectId = assignment?.projectId;
      
      await deleteDoc(doc(db, 'taskAssignments', assignmentId));
      
      // Update project costs if we have a projectId
      if (projectId) {
        await updateProjectActualCost(projectId);
      }
      
      await loadAssignments();
      
      // Notify parent component to refresh stats
      if (onAssignmentCreated) {
        onAssignmentCreated();
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to delete assignment');
    }
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const selectedStaff = staff.find(s => s.id === selectedStaffId);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{t('taskAssignment.title')}</h2>
          {onClose && (
            <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
          )}
        </div>

        {/* Assignment Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('taskAssignment.date')}</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('taskAssignment.project')}</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            >
              <option value="">{t('taskAssignment.selectProject')}</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={bulkMode}
                onChange={(e) => setBulkMode(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">{t('taskAssignment.multipleStaff')}</span>
            </label>
            {selectedProjectId && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={multiTaskMode}
                  onChange={(e) => {
                    setMultiTaskMode(e.target.checked);
                    if (e.target.checked) {
                      setSelectedTaskIds([]);
                      setSelectedTaskId('');
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">{t('taskAssignment.multipleTasks')}</span>
              </label>
            )}
          </div>

          {bulkMode ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Staff Members
              </label>
              <div className="border border-gray-300 rounded-xl p-3 max-h-48 overflow-y-auto">
                {staff.map(member => (
                  <label key={member.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStaffIds.includes(member.id)}
                      onChange={() => toggleStaffSelection(member.id)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <span className="font-medium">{member.name}</span>
                      <span className="text-sm text-gray-500 ml-2">${member.dailyRate || 0}/day</span>
                    </div>
                  </label>
                ))}
              </div>
              {selectedStaffIds.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  {selectedStaffIds.length} staff member(s) selected
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('taskAssignment.staffMember')}</label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              >
                <option value="">{t('taskAssignment.selectStaffMember')}</option>
                {staff.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} - ${member.dailyRate || 0}/day
                  </option>
                ))}
              </select>
              {selectedStaff && (
                <p className="text-sm text-gray-600 mt-2">
                  Daily Rate: ${selectedStaff.dailyRate?.toFixed(2) || '0.00'}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task(s) *
              {loadingTasks && <span className="text-xs text-gray-500 ml-2">(Loading tasks...)</span>}
            </label>
            {selectedProjectId ? (
              multiTaskMode ? (
                // Multi-task selection mode
                <div>
                  <div className="border border-gray-300 rounded-xl p-3 max-h-64 overflow-y-auto mb-2">
                    {projectTasks.length > 0 ? (
                      projectTasks.map(task => (
                        <label key={task.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.includes(task.id)}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="mr-3"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{task.title}</span>
                            <span className="text-sm text-gray-500 ml-2">({task.status})</span>
                          </div>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 p-2">No tasks found in this project</p>
                    )}
                    <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer border-t border-gray-200 mt-2 pt-2">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes('custom')}
                        onChange={() => toggleTaskSelection('custom')}
                        className="mr-3"
                      />
                      <span className="font-medium">➕ Custom Task</span>
                    </label>
                  </div>
                  {selectedTaskIds.length > 0 && (
                    <p className="text-sm text-gray-600 mb-2">
                      {selectedTaskIds.length} task(s) selected
                    </p>
                  )}
                  {selectedTaskIds.includes('custom') && (
                    <Input
                      placeholder="Enter custom task description..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      className="mb-2"
                    />
                  )}
                </div>
              ) : (
                // Single task selection mode
                <>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => {
                      setSelectedTaskId(e.target.value);
                      if (e.target.value === 'custom') {
                        setTaskDescription('');
                      } else {
                        const task = projectTasks.find(t => t.id === e.target.value);
                        setTaskDescription(task?.title || '');
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base mb-2"
                  >
                    <option value="">Select a task from project...</option>
                    {projectTasks.map(task => (
                      <option key={task.id} value={task.id}>
                        {task.title} ({task.status})
                      </option>
                    ))}
                    <option value="custom">{t('taskAssignment.customTask')}</option>
                  </select>
                  
                  {selectedTaskId === 'custom' && (
                    <Input
                      placeholder="Enter custom task description..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                    />
                  )}
                  
                  {selectedTaskId && selectedTaskId !== 'custom' && (
                    <p className="text-sm text-gray-600 mt-2">
                      {t('taskAssignment.selected')}: {taskDescription}
                    </p>
                  )}
                </>
              )
            ) : (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500">{t('taskAssignment.selectProjectFirst')}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('taskAssignment.notes')}</label>
            <textarea
              placeholder={t('taskAssignment.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              rows={3}
            />
          </div>

          <Button
            onClick={handleAssign}
            disabled={saving || loading}
            className="w-full"
          >
            {saving ? t('taskAssignment.assigning') : t('taskAssignment.assignTask')}
          </Button>
        </div>
      </Card>

      {/* Today's Assignments */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Assignments for {selectedDate}
        </h3>
        
        {assignments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No assignments for this date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(assignment => (
              <div key={assignment.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{assignment.staffName}</p>
                    <p className="text-sm text-gray-600 mt-1">{assignment.projectName}</p>
                    <p className="text-sm text-gray-800 mt-2">{assignment.taskDescription}</p>
                    {assignment.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">{assignment.notes}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Rate: ${assignment.dailyRate.toFixed(2)}/day
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteAssignment(assignment.id)}
                    className="text-red-600 hover:text-red-700 text-sm ml-4"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            
            <div className="pt-3 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-900">
                Total Daily Labor Cost: ${assignments.reduce((sum, a) => sum + a.dailyRate, 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TaskAssignmentManager;


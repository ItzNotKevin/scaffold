import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import type { TaskAssignment, Task } from '../lib/types';
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
  isTemplate?: boolean;
  projectId?: string | null;
}

const TaskAssignmentManager: React.FC<TaskAssignmentManagerProps> = ({ onClose, onAssignmentCreated }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  // Add task modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [showTaskNotesField, setShowTaskNotesField] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState('');
  
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
    loadTaskTemplates();
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
      try {
        const staffSnapshot = await getDocs(collection(db, 'staffMembers'));
        const staffData = staffSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unknown Staff',
            dailyRate: typeof data.dailyRate === 'number' ? data.dailyRate : 0,
            ...data
          } as StaffMember;
        });
        setStaff(staffData);
        console.log(`Loaded ${staffData.length} staff members`);
      } catch (staffError: any) {
        console.error('Error loading staff members:', staffError);
        alert(`Error loading staff members: ${staffError?.message || 'Unknown error'}\n\nPlease refresh the page.`);
        setStaff([]);
      }

      // Load projects
      try {
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        const projectsData = projectsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unnamed Project'
          };
        });
        setProjects(projectsData);
        console.log(`Loaded ${projectsData.length} projects`);
      } catch (projectsError: any) {
        console.error('Error loading projects:', projectsError);
        alert(`Error loading projects: ${projectsError?.message || 'Unknown error'}\n\nPlease refresh the page.`);
        setProjects([]);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert(`Error loading data: ${error?.message || 'Unknown error'}\n\nPlease refresh the page.`);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    if (!selectedDate) {
      setAssignments([]);
      return;
    }

    try {
      const assignmentsQuery = query(
        collection(db, 'taskAssignments'),
        where('date', '==', selectedDate)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentsData = assignmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          projectId: data.projectId || '',
          projectName: data.projectName || 'Unknown Project',
          staffId: data.staffId || '',
          staffName: data.staffName || 'Unknown Staff',
          taskDescription: data.taskDescription || '',
          taskId: data.taskId || undefined,
          date: data.date || selectedDate,
          dailyRate: typeof data.dailyRate === 'number' ? data.dailyRate : 0,
          notes: data.notes || '',
          createdBy: data.createdBy || '',
          createdAt: data.createdAt || null
        } as TaskAssignment;
      });
      setAssignments(assignmentsData);
      console.log(`Loaded ${assignmentsData.length} assignments for ${selectedDate}`);
    } catch (error: any) {
      console.error('Error loading assignments:', error);
      // Don't show alert for loading errors - just log them
      // This prevents annoying alerts when the component first loads
      if (error?.code === 'failed-precondition') {
        console.error('Firestore index may be missing for date query. Check Firebase Console.');
      }
      setAssignments([]);
    }
  };


  const loadTaskTemplates = async () => {
    try {
      const templatesQuery = query(
        collection(db, 'tasks'),
        where('isTemplate', '==', true),
        orderBy('title', 'asc')
      );
      const templatesSnapshot = await getDocs(templatesQuery);
      const templatesData = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
      setTaskTemplates(templatesData);
    } catch (error: any) {
      console.error('Error loading task templates:', error);
      // Fallback: try loading all tasks and filter
      try {
        const allTasksQuery = query(collection(db, 'tasks'));
        const allTasksSnapshot = await getDocs(allTasksQuery);
        const allTasks = allTasksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Task));
        const templateTasks = allTasks.filter(
          task => task.isTemplate === true || task.projectId === null || task.projectId === undefined
        );
        setTaskTemplates(templateTasks);
      } catch (fallbackError) {
        console.error('Error in fallback template loading:', fallbackError);
      }
    }
  };

  const loadProjectTasks = async (projectId: string) => {
    if (!projectId || projectId.trim() === '') {
      setProjectTasks([]);
      return;
    }

    setLoadingTasks(true);
    try {
      // Load tasks that belong to this project
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Untitled Task',
          status: data.status || 'todo',
          isTemplate: data.isTemplate || false
        };
      });
      setProjectTasks(tasksData);
      console.log(`Loaded ${tasksData.length} tasks for project ${projectId}`);
    } catch (error: any) {
      console.error('Error loading project tasks:', error);
      if (error?.code === 'failed-precondition') {
        console.error('Firestore index may be missing for projectId query. Check Firebase Console.');
      }
      setProjectTasks([]);
      // Don't show alert - just log the error
      // User can still create custom tasks
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
    if (!currentUser) {
      alert('Error: You must be logged in to create assignments');
      return;
    }

    // Validate date
    if (!selectedDate || selectedDate.trim() === '') {
      alert('Error: Please select a date');
      return;
    }

    // Validate project
    if (!selectedProjectId || selectedProjectId.trim() === '') {
      alert('Error: Please select a project');
      return;
    }

    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) {
      alert('Error: Selected project not found. Please refresh the page.');
      return;
    }

    // Get and validate staff IDs
    const staffIds = bulkMode 
      ? selectedStaffIds.filter(id => id && id.trim() !== '')
      : selectedStaffId && selectedStaffId.trim() !== '' 
        ? [selectedStaffId] 
        : [];
    
    if (staffIds.length === 0) {
      alert('Error: Please select at least one staff member');
      return;
    }

    // Validate staff members exist
    const validStaffMembers = staffIds
      .map(id => staff.find(s => s.id === id))
      .filter((member): member is StaffMember => member !== undefined);
    
    if (validStaffMembers.length === 0) {
      alert('Error: Selected staff members not found. Please refresh the page.');
      return;
    }

    if (validStaffMembers.length !== staffIds.length) {
      alert(`Warning: ${staffIds.length - validStaffMembers.length} staff member(s) not found. Continuing with ${validStaffMembers.length} valid staff member(s).`);
    }
    
    // Get task IDs to assign
    let taskIdsToAssign: string[] = [];
    let taskDescriptions: Array<{ taskId?: string; description: string }> = [];
    
    if (multiTaskMode) {
      // Multiple tasks selected
      if (selectedTaskIds.length === 0) {
        // No tasks selected - create assignment without task description
        taskDescriptions = [{ taskId: undefined, description: 'General Work' }];
      } else {
        // Validate custom task has description if selected
        if (selectedTaskIds.includes('custom') && !taskDescription.trim()) {
          alert('Error: Please enter a description for the custom task');
          return;
        }

        taskIdsToAssign = selectedTaskIds;
        try {
          const mappedTasks = await Promise.all(selectedTaskIds.map(async (taskId) => {
            if (taskId === 'custom') {
              if (!taskDescription.trim()) {
                throw new Error('Custom task description is required');
              }
              // Custom task - just use the description, don't save as template
              return { taskId: undefined, description: taskDescription.trim() };
            } else {
              // Handle project task or task template
              let task = projectTasks.find(t => t.id === taskId);
              if (!task) {
                // Check if it's a task template
                const template = taskTemplates.find(t => t.id === taskId);
                if (template) {
                  return { taskId, description: template.title || 'Untitled Task' };
                }
                console.warn(`Task ${taskId} not found in project tasks or templates`);
                return { taskId, description: 'Unknown Task' };
              }
              return { taskId, description: task.title || 'Untitled Task' };
            }
          }));
          taskDescriptions = mappedTasks.filter(task => task.description.trim() !== ''); // Filter out empty descriptions
        } catch (error: any) {
          console.error('Error mapping tasks:', error);
          alert(`Error processing tasks: ${error?.message || 'Unknown error'}. Please try again.`);
          return;
        }

        if (taskDescriptions.length === 0) {
          // Fallback if all tasks filtered out
          taskDescriptions = [{ taskId: undefined, description: 'General Work' }];
        }
      }
    } else {
      // Single task
        let finalTaskDescription = taskDescription.trim();
        let finalTaskId: string | undefined = undefined;
        
        if (selectedTaskId && selectedTaskId !== 'custom') {
          // Handle project task
          const selectedTask = projectTasks.find(t => t.id === selectedTaskId);
          if (selectedTask) {
            finalTaskDescription = selectedTask.title || taskDescription.trim();
            finalTaskId = selectedTaskId;
          } else {
            console.warn(`Selected task ${selectedTaskId} not found`);
          }
        } else if (selectedTaskId === 'custom') {
          // Custom task - just use the description, don't save as template
          finalTaskDescription = taskDescription.trim();
        }
        
        // If no task description, use default
        if (!finalTaskDescription || finalTaskDescription.trim() === '') {
          finalTaskDescription = 'General Work';
        }
        
        taskDescriptions = [{ taskId: finalTaskId, description: finalTaskDescription }];
      }

    setSaving(true);
    let assignmentCount = 0;
    const createdAssignmentIds: string[] = [];
    const errors: string[] = [];

    try {
      // Create assignments
      for (const staffMember of validStaffMembers) {
        for (const taskInfo of taskDescriptions) {
          try {
            // Validate required fields before creating
            if (!staffMember.id || !staffMember.name) {
              throw new Error(`Invalid staff member: missing id or name`);
            }
            if (!taskInfo.description || taskInfo.description.trim() === '') {
              throw new Error(`Invalid task description`);
            }
            if (!selectedProjectId) {
              throw new Error(`Invalid project ID`);
            }
            if (!selectedDate) {
              throw new Error(`Invalid date`);
            }

            // Build assignment data, excluding undefined values
            const assignmentData: any = {
              projectId: selectedProjectId,
              projectName: project.name || 'Unknown Project',
              staffId: staffMember.id,
              staffName: staffMember.name,
              taskDescription: taskInfo.description.trim(),
              date: selectedDate,
              dailyRate: typeof staffMember.dailyRate === 'number' ? staffMember.dailyRate : 0,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp()
            };

            // Only add optional fields if they have values
            if (taskInfo.taskId) {
              assignmentData.taskId = taskInfo.taskId;
            }
            if (notes.trim()) {
              assignmentData.notes = notes.trim();
            }

            console.log('Creating assignment:', assignmentData);
            const docRef = await addDoc(collection(db, 'taskAssignments'), assignmentData);
            createdAssignmentIds.push(docRef.id);
            assignmentCount++;
          } catch (error: any) {
            const errorMessage = error?.message || 'Unknown error';
            const errorCode = error?.code || 'unknown';
            const taskDesc = taskInfo.description || 'Unknown Task';
            console.error(`Error creating assignment for ${staffMember.name} - ${taskDesc}:`, error);
            errors.push(`${staffMember.name} - ${taskDesc}: ${errorMessage} (${errorCode})`);
          }
        }
      }

      // Only update project cost if we created at least one assignment
      if (assignmentCount > 0) {
        try {
          await updateProjectActualCost(selectedProjectId);
        } catch (costError: any) {
          console.error('Error updating project cost (assignments were created):', costError);
          // Don't fail the whole operation if cost update fails
          errors.push(`Warning: Cost update failed: ${costError?.message || 'Unknown error'}`);
        }
      }
      
      // Show results
      if (assignmentCount > 0) {
        // Reset form only on success
        setSelectedStaffId('');
        setSelectedStaffIds([]);
        setSelectedTaskId('');
        setSelectedTaskIds([]);
        setTaskDescription('');
        setNotes('');
        // Don't reset project so user can assign multiple tasks to same project
        
        // Reload assignments to show updated list
        try {
          await loadAssignments();
        } catch (loadError) {
          console.error('Error reloading assignments:', loadError);
        }
        
        // Notify parent component to refresh stats immediately
        if (onAssignmentCreated) {
          onAssignmentCreated();
        }
        
        // Show success message
        const totalCost = validStaffMembers.reduce((sum, member) => {
          const rate = typeof member.dailyRate === 'number' ? member.dailyRate : 0;
          return sum + (rate * taskDescriptions.length);
        }, 0);

        let message = `✓ Successfully created ${assignmentCount} assignment(s)\n${validStaffMembers.length} staff × ${taskDescriptions.length} task(s)\nTotal cost: $${totalCost.toFixed(2)}`;
        if (errors.length > 0) {
          message += `\n\nWarnings:\n${errors.join('\n')}`;
        }
        alert(message);
      } else {
        // No assignments were created
        const errorMsg = errors.length > 0 
          ? `Failed to create assignments:\n\n${errors.join('\n')}`
          : 'Failed to create assignments. Please check the console for details.';
        alert(errorMsg);
      }
    } catch (error: any) {
      console.error('Error in handleAssign:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      const errorCode = error?.code || 'unknown';
      alert(`Failed to create assignments: ${errorMessage}\n\nError code: ${errorCode}\n\nPlease check the browser console for more details.`);
      
      // If we created some assignments but then failed, try to clean up
      // (In production, you might want to keep them or provide a way to retry)
      if (createdAssignmentIds.length > 0) {
        console.warn(`${createdAssignmentIds.length} assignment(s) were created before the error occurred. They are not being deleted.`);
      }
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

  const resetTaskModal = () => {
    setShowAddTaskModal(false);
    setNewTaskTitle('');
    setNewTaskNotes('');
    setShowTaskNotesField(false);
    setTaskError('');
    setCreatingTask(false);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any previous errors
    setTaskError('');

    // Validate user is logged in
    if (!currentUser) {
      setTaskError('You must be logged in to create tasks.');
      return;
    }

    // Validate project is selected
    if (!selectedProjectId || selectedProjectId.trim() === '') {
      setTaskError('Please select a project first before creating a task.');
      return;
    }

    // Validate task title
    if (!newTaskTitle || !newTaskTitle.trim()) {
      setTaskError('Task title is required.');
      return;
    }

    setCreatingTask(true);

    try {
      const taskData = {
        title: newTaskTitle.trim(),
        description: newTaskNotes.trim() || '',
        status: 'todo' as const,
        priority: 'medium' as const,
        projectId: selectedProjectId,
        isTemplate: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'tasks'), taskData);
      const newTaskId = docRef.id;

      // Reload project tasks to include the new task
      try {
        await loadProjectTasks(selectedProjectId);
      } catch (loadError: any) {
        console.warn('Error reloading project tasks (task was created):', loadError);
        // Continue even if reload fails - the task was created successfully
      }

      // If in multi-task mode, automatically select the newly created task
      if (multiTaskMode) {
        setSelectedTaskIds(prev => [...prev, newTaskId]);
      } else {
        // In single task mode, select the new task
        setSelectedTaskId(newTaskId);
        setTaskDescription(newTaskTitle.trim());
      }

      // Close modal and reset form
      resetTaskModal();
    } catch (error: any) {
      console.error('Error creating task:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      const errorCode = error?.code || 'unknown';
      setTaskError(`Failed to create task: ${errorMessage} (${errorCode})`);
    } finally {
      setCreatingTask(false);
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
  
  // Combine project tasks and task templates for display
  const allAvailableTasks = [...projectTasks, ...taskTemplates.map(t => ({ id: t.id, title: t.title, status: t.status || 'todo', isTemplate: true }))];

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t('taskAssignment.title')}</h2>
          {onClose && (
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">{t('common.close')}</Button>
          )}
        </div>

        {/* Assignment Form */}
        <div className="space-y-3 sm:space-y-4">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base touch-manipulation min-h-[44px]"
              >
              <option value="">{t('taskAssignment.selectProject')}</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center touch-manipulation min-h-[44px]">
              <input
                type="checkbox"
                checked={bulkMode}
                onChange={(e) => setBulkMode(e.target.checked)}
                className="mr-2 w-5 h-5"
              />
              <span className="text-sm font-medium text-gray-700">{t('taskAssignment.multipleStaff')}</span>
            </label>
            {selectedProjectId && (
              <label className="flex items-center touch-manipulation min-h-[44px]">
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
                  className="mr-2 w-5 h-5"
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
                        <label key={member.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer touch-manipulation min-h-[44px]">
                          <input
                            type="checkbox"
                            checked={selectedStaffIds.includes(member.id)}
                            onChange={() => toggleStaffSelection(member.id)}
                            className="mr-3 w-5 h-5"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base touch-manipulation min-h-[44px]"
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
              Task(s) (Optional)
                              {loadingTasks && <span className="text-xs text-gray-500 ml-2">(Loading tasks...)</span>}
            </label>
            {selectedProjectId ? (
              multiTaskMode ? (
                // Multi-task selection mode
                <div>
                  <div className="border border-gray-300 rounded-xl p-3 max-h-64 overflow-y-auto mb-2">
                    {/* Project Tasks Section */}
                    {projectTasks.length > 0 && (
                      <>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
                          Project Tasks
                        </div>
                        {projectTasks.map(task => (
                          <label key={task.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer touch-manipulation min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.includes(task.id)}
                              onChange={() => toggleTaskSelection(task.id)}
                              className="mr-3 w-5 h-5"
                            />
                            <div className="flex-1">
                              <span className="font-medium">{task.title}</span>
                              <span className="text-sm text-gray-500 ml-2">({task.status})</span>
                            </div>
                          </label>
                        ))}
                      </>
                    )}
                    
                    {/* Task Templates Section */}
                    {taskTemplates.length > 0 && (
                      <>
                        {projectTasks.length > 0 && (
                          <div className="border-t border-gray-200 mt-2 pt-2"></div>
                        )}
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
                          Task Templates
                        </div>
                        {taskTemplates.map(task => (
                          <label key={task.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer touch-manipulation min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.includes(task.id)}
                              onChange={() => toggleTaskSelection(task.id)}
                              className="mr-3 w-5 h-5"
                            />
                            <div className="flex-1">
                              <span className="font-medium">{task.title}</span>
                            </div>
                          </label>
                        ))}
                      </>
                    )}
                    
                    {/* Show message if no tasks */}
                    {projectTasks.length === 0 && taskTemplates.length === 0 && (
                      <p className="text-sm text-gray-500 p-2">No tasks found. Create project tasks or use custom task.</p>
                    )}
                    
                    {/* Add New Task Option */}
                    {(projectTasks.length > 0 || taskTemplates.length > 0) && (
                      <>
                        <div className="border-t border-gray-200 mt-2 pt-2"></div>
                        <label 
                          className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer touch-manipulation min-h-[44px]"
                          onClick={() => setShowAddTaskModal(true)}
                        >
                          <span className="font-medium text-blue-600">➕ Add new task...</span>
                        </label>
                      </>
                    )}
                    
                    {/* Custom Task Option */}
                    {(projectTasks.length > 0 || taskTemplates.length > 0) && (
                      <div className="border-t border-gray-200 mt-2 pt-2"></div>
                    )}
                    <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer touch-manipulation min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes('custom')}
                        onChange={() => toggleTaskSelection('custom')}
                        className="mr-3 w-5 h-5"
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
                      if (e.target.value === '__add_new__') {
                        setShowAddTaskModal(true);
                        setSelectedTaskId('');
                      } else {
                        setSelectedTaskId(e.target.value);
                        if (e.target.value === 'custom') {
                          setTaskDescription('');
                        } else {
                          const task = allAvailableTasks.find(t => t.id === e.target.value);
                          setTaskDescription(task?.title || '');
                        }
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base mb-2 touch-manipulation min-h-[44px]"
                  >
                    <option value="">Select a task...</option>
                    {/* Project Tasks */}
                    {projectTasks.length > 0 && (
                      <optgroup label="Project Tasks">
                        {projectTasks.map(task => (
                          <option key={task.id} value={task.id}>
                            {task.title} ({task.status})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {/* Task Templates */}
                    {taskTemplates.length > 0 && (
                      <optgroup label="Task Templates">
                        {taskTemplates.map(task => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {(projectTasks.length > 0 || taskTemplates.length > 0) && (
                      <option value="__add_new__">+ Add new task...</option>
                    )}
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base touch-manipulation"
              rows={3}
            />
          </div>

          <Button
            onClick={handleAssign}
            disabled={saving || loading}
            className="w-full min-h-[44px]"
          >
            {saving ? t('taskAssignment.assigning') : t('taskAssignment.assignTask')}
          </Button>
        </div>
      </Card>

      {/* Today's Assignments */}
      <Card className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          Assignments for {selectedDate}
        </h3>
        
        {assignments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No assignments for this date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(assignment => (
              <div key={assignment.id} className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base">{assignment.staffName}</p>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">{assignment.projectName}</p>
                    <p className="text-xs sm:text-sm text-gray-800 mt-2 break-words">{assignment.taskDescription}</p>
                    {assignment.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic break-words">{assignment.notes}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Rate: ${assignment.dailyRate.toFixed(2)}/day
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteAssignment(assignment.id)}
                    className="text-red-600 hover:text-red-700 text-sm sm:ml-4 touch-manipulation min-h-[44px] px-3 py-2 rounded-lg hover:bg-red-50 self-start sm:self-auto"
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

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Add New Task
              </h2>
              <button
                onClick={resetTaskModal}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <Input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => {
                    setNewTaskTitle(e.target.value);
                    setTaskError('');
                  }}
                  placeholder="e.g., Framing, Drywall Installation, Painting"
                  required
                  autoFocus
                />
              </div>

              {/* Optional Fields - Toggleable */}
              <div className="flex flex-wrap gap-2 mb-3">
                {!showTaskNotesField && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTaskNotesField(true)}
                    className="text-sm"
                  >
                    + Add Notes
                  </Button>
                )}
              </div>

              {/* Notes Field */}
              {showTaskNotesField && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Notes
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowTaskNotesField(false);
                        setNewTaskNotes('');
                      }}
                      className="text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                  <textarea
                    value={newTaskNotes}
                    onChange={(e) => setNewTaskNotes(e.target.value)}
                    placeholder="Additional notes..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base touch-manipulation"
                    rows={3}
                  />
                </div>
              )}

              {taskError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{taskError}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
                <Button 
                  type="submit" 
                  disabled={creatingTask || !newTaskTitle.trim()} 
                  className="w-full sm:w-auto"
                >
                  {creatingTask ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Task'
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={resetTaskModal} 
                  className="w-full sm:w-auto"
                  disabled={creatingTask}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskAssignmentManager;


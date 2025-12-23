import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
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
  const [templateTasks, setTemplateTasks] = useState<ProjectTask[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
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
    loadTemplateTasks();
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
        
        // Handle both old format (single task) and new format (tasks array)
        let tasks: any[] = [];
        if (data.tasks && Array.isArray(data.tasks)) {
          // New format with tasks array
          tasks = data.tasks;
        } else if (data.taskDescription) {
          // Old format - convert to new format
          tasks = [{
            taskDescription: data.taskDescription || '',
            taskId: data.taskId || undefined,
            notes: data.notes || undefined
          }];
        }
        
        return {
          id: doc.id,
          projectId: data.projectId || '',
          projectName: data.projectName || 'Unknown Project',
          staffId: data.staffId || '',
          staffName: data.staffName || 'Unknown Staff',
          tasks: tasks,
          date: data.date || selectedDate,
          dailyRate: typeof data.dailyRate === 'number' ? data.dailyRate : 0,
          createdBy: data.createdBy || '',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null
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

  const loadTemplateTasks = async () => {
    setLoadingTemplates(true);
    try {
      // Load template tasks (isTemplate === true)
      const templatesQuery = query(
        collection(db, 'tasks'),
        where('isTemplate', '==', true)
      );
      const templatesSnapshot = await getDocs(templatesQuery);
      const templatesData = templatesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Untitled Task',
          status: data.status || 'todo'
        };
      });
      setTemplateTasks(templatesData);
      console.log(`Loaded ${templatesData.length} template tasks`);
    } catch (error: any) {
      console.error('Error loading template tasks:', error);
      // Fallback: try loading all tasks and filter
      try {
        const allTasksQuery = query(collection(db, 'tasks'));
        const allTasksSnapshot = await getDocs(allTasksQuery);
        const allTasks = allTasksSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || 'Untitled Task',
            status: data.status || 'todo',
            isTemplate: data.isTemplate || false,
            projectId: data.projectId || null
          };
        });
        const templateTasks = allTasks.filter(
          task => task.isTemplate === true || task.projectId === null
        );
        setTemplateTasks(templateTasks);
        console.log(`Loaded ${templateTasks.length} template tasks (fallback method)`);
      } catch (fallbackError) {
        console.error('Error in fallback template loading:', fallbackError);
        setTemplateTasks([]);
      }
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadProjectTasks = async (projectId: string) => {
    if (!projectId || projectId.trim() === '') {
      setProjectTasks([]);
      return;
    }

    setLoadingTasks(true);
    try {
      // Only load tasks that belong to this project (not templates)
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || 'Untitled Task',
            status: data.status || 'todo',
            isTemplate: data.isTemplate || false
          };
        })
        .filter(task => task.isTemplate !== true); // Exclude templates from project tasks
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
        taskDescriptions = selectedTaskIds.map(taskId => {
          if (taskId === 'custom') {
            if (!taskDescription.trim()) {
              throw new Error('Custom task description is required');
            }
            return { taskId: undefined, description: taskDescription.trim() };
          } else if (taskId.startsWith('template-')) {
            // Handle template task
            const templateId = taskId.replace('template-', '');
            const task = templateTasks.find(t => t.id === templateId);
            if (!task) {
              console.warn(`Template task ${templateId} not found`);
              return { taskId: undefined, description: 'Unknown Template Task' };
            }
            return { taskId: undefined, description: task.title || 'Untitled Task' };
          } else {
            // Handle project task
            const task = projectTasks.find(t => t.id === taskId);
            if (!task) {
              console.warn(`Task ${taskId} not found in project tasks`);
              return { taskId, description: 'Unknown Task' };
            }
            return { taskId, description: task.title || 'Untitled Task' };
          }
        }).filter(task => task.description.trim() !== ''); // Filter out empty descriptions

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
        if (selectedTaskId.startsWith('template-')) {
          // Handle template task
          const templateId = selectedTaskId.replace('template-', '');
          const selectedTask = templateTasks.find(t => t.id === templateId);
          if (selectedTask) {
            finalTaskDescription = selectedTask.title || taskDescription.trim();
            finalTaskId = undefined; // Template tasks don't have a project taskId
          } else {
            console.warn(`Selected template task ${templateId} not found`);
          }
        } else {
          // Handle project task
          const selectedTask = projectTasks.find(t => t.id === selectedTaskId);
          if (selectedTask) {
            finalTaskDescription = selectedTask.title || taskDescription.trim();
            finalTaskId = selectedTaskId;
          } else {
            console.warn(`Selected task ${selectedTaskId} not found`);
          }
        }
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
      // Create or update assignments - merge tasks into existing assignments per staff+project+date
      for (const staffMember of validStaffMembers) {
        try {
          // Validate required fields
          if (!staffMember.id || !staffMember.name) {
            throw new Error(`Invalid staff member: missing id or name`);
          }
          if (!selectedProjectId) {
            throw new Error(`Invalid project ID`);
          }
          if (!selectedDate) {
            throw new Error(`Invalid date`);
          }

          // Prepare new tasks to add
          const newTasks = taskDescriptions.map(taskInfo => {
            if (!taskInfo.description || taskInfo.description.trim() === '') {
              throw new Error(`Invalid task description`);
            }
            
            const task: any = {
              taskDescription: taskInfo.description.trim()
            };
            
            if (taskInfo.taskId) {
              task.taskId = taskInfo.taskId;
            }
            if (notes.trim()) {
              task.notes = notes.trim();
            }
            
            return task;
          });

          // Check if assignment already exists for this staff+project+date combination
          // Query by date (we already have this date selected) and filter in code to avoid index requirements
          const existingAssignmentQuery = query(
            collection(db, 'taskAssignments'),
            where('date', '==', selectedDate)
          );
          const existingSnapshot = await getDocs(existingAssignmentQuery);
          // Filter to find matching staff+project combination
          const existingAssignmentDoc = existingSnapshot.docs.find(doc => {
            const data = doc.data();
            return data.staffId === staffMember.id && data.projectId === selectedProjectId;
          });
          
          if (existingAssignmentDoc) {
            // Update existing assignment - merge tasks
            const existingData = existingAssignmentDoc.data();
            // Handle both old format (single task) and new format (tasks array)
            let existingTasks: any[] = [];
            if (existingData.tasks && Array.isArray(existingData.tasks)) {
              existingTasks = existingData.tasks;
            } else if (existingData.taskDescription) {
              // Old format - convert to new format
              existingTasks = [{
                taskDescription: existingData.taskDescription || '',
                taskId: existingData.taskId || undefined,
                notes: existingData.notes || undefined
              }];
            }
            
            // Merge new tasks with existing tasks (avoid duplicates by checking description)
            const mergedTasks = [...existingTasks];
            newTasks.forEach(newTask => {
              // Only add if not already present (check by description)
              if (!mergedTasks.some(t => t.taskDescription === newTask.taskDescription)) {
                mergedTasks.push(newTask);
              }
            });
            
            await updateDoc(doc(db, 'taskAssignments', existingAssignmentDoc.id), {
              tasks: mergedTasks,
              updatedAt: serverTimestamp()
            });
            
            createdAssignmentIds.push(existingAssignmentDoc.id);
            assignmentCount += mergedTasks.length - existingTasks.length; // Count newly added tasks
          } else {
            // Create new assignment with tasks array
            const assignmentData: any = {
              projectId: selectedProjectId,
              projectName: project.name || 'Unknown Project',
              staffId: staffMember.id,
              staffName: staffMember.name,
              tasks: newTasks,
              date: selectedDate,
              dailyRate: typeof staffMember.dailyRate === 'number' ? staffMember.dailyRate : 0,
              createdBy: currentUser.uid,
              createdAt: serverTimestamp()
            };

            console.log('Creating assignment:', assignmentData);
            const docRef = await addDoc(collection(db, 'taskAssignments'), assignmentData);
            createdAssignmentIds.push(docRef.id);
            assignmentCount += newTasks.length;
          }
        } catch (error: any) {
          const errorMessage = error?.message || 'Unknown error';
          const errorCode = error?.code || 'unknown';
          console.error(`Error creating/updating assignment for ${staffMember.name}:`, error);
          errors.push(`${staffMember.name}: ${errorMessage} (${errorCode})`);
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
        // Only count each staff member's wage once per day, regardless of number of tasks
        const totalCost = validStaffMembers.reduce((sum, member) => {
          const rate = typeof member.dailyRate === 'number' ? member.dailyRate : 0;
          return sum + rate; // Count each staff member once, not multiplied by tasks
        }, 0);

        const tasksAdded = assignmentCount;
        const assignmentsUpdated = createdAssignmentIds.length;
        let message = `✓ Successfully added ${tasksAdded} task(s) to ${assignmentsUpdated} assignment(s)\n${validStaffMembers.length} staff member(s)\nTotal cost: $${totalCost.toFixed(2)}`;
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

  const handleDeleteTask = async (assignmentId: string, taskIndex: number) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment || !assignment.tasks[taskIndex]) return;
    
    const task = assignment.tasks[taskIndex];
    if (!confirm(`Are you sure you want to delete the task "${task.taskDescription}"?`)) return;

    try {
      const updatedTasks = assignment.tasks.filter((_, index) => index !== taskIndex);
      
      if (updatedTasks.length === 0) {
        // If no tasks left, delete the entire assignment
        await handleDeleteAssignment(assignmentId);
        return;
      }
      
      // Update assignment with remaining tasks
      await updateDoc(doc(db, 'taskAssignments', assignmentId), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp()
      });
      
      // Update project costs
      if (assignment.projectId) {
        await updateProjectActualCost(assignment.projectId);
      }
      
      await loadAssignments();
      
      // Notify parent component to refresh stats
      if (onAssignmentCreated) {
        onAssignmentCreated();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment and all its tasks?')) return;

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

  // Calculate total daily labor cost - only count each staff member's wage once per day
  const totalDailyLaborCost = useMemo(() => {
    const dailyWages = new Map<string, number>(); // key: `${staffId}_${date}`, value: dailyRate
    assignments.forEach(assignment => {
      const key = `${assignment.staffId}_${assignment.date}`;
      if (!dailyWages.has(key)) {
        dailyWages.set(key, assignment.dailyRate);
      }
    });
    return Array.from(dailyWages.values()).reduce((sum, rate) => sum + rate, 0);
  }, [assignments]);

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
              {(loadingTasks || loadingTemplates) && <span className="text-xs text-gray-500 ml-2">(Loading tasks...)</span>}
            </label>
            {selectedProjectId ? (
              multiTaskMode ? (
                // Multi-task selection mode
                <div>
                  <div className="border border-gray-300 rounded-xl p-3 max-h-64 overflow-y-auto mb-2">
                    {/* Template Tasks Section */}
                    {templateTasks.length > 0 && (
                      <>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2">
                          🌐 Universal Templates
                        </div>
                        {templateTasks.map(task => (
                          <label key={`template-${task.id}`} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer touch-manipulation min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.includes(`template-${task.id}`)}
                              onChange={() => toggleTaskSelection(`template-${task.id}`)}
                              className="mr-3 w-5 h-5"
                            />
                            <div className="flex-1">
                              <span className="font-medium">{task.title}</span>
                              <span className="text-xs text-blue-600 ml-2">🌐</span>
                            </div>
                          </label>
                        ))}
                      </>
                    )}
                    
                    {/* Project Tasks Section */}
                    {projectTasks.length > 0 && (
                      <>
                        {templateTasks.length > 0 && (
                          <div className="border-t border-gray-200 my-2"></div>
                        )}
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
                    
                    {/* Show message if no tasks */}
                    {templateTasks.length === 0 && projectTasks.length === 0 && (
                      <p className="text-sm text-gray-500 p-2">No tasks found. Create template tasks or project tasks.</p>
                    )}
                    
                    {/* Custom Task Option */}
                    {(templateTasks.length > 0 || projectTasks.length > 0) && (
                      <div className="border-t border-gray-200 mt-2"></div>
                    )}
                    <label className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer border-t border-gray-200 mt-2 pt-2 touch-manipulation min-h-[44px]">
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
                      setSelectedTaskId(e.target.value);
                      if (e.target.value === 'custom') {
                        setTaskDescription('');
                      } else if (e.target.value.startsWith('template-')) {
                        const templateId = e.target.value.replace('template-', '');
                        const task = templateTasks.find(t => t.id === templateId);
                        setTaskDescription(task?.title || '');
                      } else {
                        const task = projectTasks.find(t => t.id === e.target.value);
                        setTaskDescription(task?.title || '');
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base mb-2 touch-manipulation min-h-[44px]"
                  >
                    <option value="">Select a task...</option>
                    {/* Template Tasks */}
                    {templateTasks.length > 0 && (
                      <optgroup label="🌐 Universal Templates">
                        {templateTasks.map(task => (
                          <option key={`template-${task.id}`} value={`template-${task.id}`}>
                            {task.title} 🌐
                          </option>
                        ))}
                      </optgroup>
                    )}
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
                      {selectedTaskId.startsWith('template-') && <span className="text-blue-600 ml-1">🌐</span>}
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
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 text-sm sm:text-base">{assignment.staffName}</p>
                        <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{assignment.projectName}</p>
                      </div>
                      <p className="text-xs text-gray-500 ml-4">
                        ${assignment.dailyRate.toFixed(2)}/day
                      </p>
                    </div>
                    
                    {/* List all tasks */}
                    <div className="space-y-2 mt-3">
                      {assignment.tasks.map((task, taskIndex) => (
                        <div key={taskIndex} className="flex items-start justify-between gap-2 pl-3 border-l-2 border-gray-300">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm text-gray-800 break-words">{task.taskDescription}</p>
                            {task.notes && (
                              <p className="text-xs text-gray-500 mt-1 italic break-words">{task.notes}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteTask(assignment.id, taskIndex)}
                            className="text-red-600 hover:text-red-700 text-xs sm:text-sm ml-2 touch-manipulation px-2 py-1 rounded hover:bg-red-50 shrink-0"
                            title="Delete this task"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAssignment(assignment.id)}
                    className="text-red-600 hover:text-red-700 text-sm sm:ml-4 touch-manipulation min-h-[44px] px-3 py-2 rounded-lg hover:bg-red-50 self-start sm:self-auto"
                  >
                    Delete All
                  </button>
                </div>
              </div>
            ))}
            
            <div className="pt-3 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-900">
                Total Daily Labor Cost: ${totalDailyLaborCost.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TaskAssignmentManager;


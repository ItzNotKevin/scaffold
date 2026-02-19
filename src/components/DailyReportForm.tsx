import React, { useState, useEffect } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { compressImage } from '../lib/imageCompression';
import type { DailyReport, WeatherData, WorkLogEntry, SafetyCheck, EquipmentEntry, MaterialEntry, IssueEntry, SubcontractorEntry, DailyReportPhoto } from '../lib/types';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';

interface DailyReportFormProps {
  projectId: string;
  existingReport?: DailyReport;
  onSave: (report: DailyReport) => void;
  onCancel: () => void;
  projectTasks?: Array<{id: string, title: string, status: string}>;
}

const DailyReportForm: React.FC<DailyReportFormProps> = ({
  projectId,
  existingReport,
  onSave,
  onCancel,
  projectTasks = []
}) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compressPhotos, setCompressPhotos] = useState(true);
  
  // Form state
  const [reportDate, setReportDate] = useState(
    existingReport?.reportDate || new Date().toISOString().split('T')[0]
  );
  const [weather, setWeather] = useState<WeatherData>(
    existingReport?.weather || {
      temperature: 0,
      condition: 'sunny',
      windSpeed: 0,
      humidity: 0,
      notes: ''
    }
  );
  const [workLog, setWorkLog] = useState<WorkLogEntry[]>(
    existingReport?.workLog || []
  );
  const [safetyChecks, setSafetyChecks] = useState<SafetyCheck[]>(
    existingReport?.safetyChecks || []
  );
  const [equipment, setEquipment] = useState<EquipmentEntry[]>(
    existingReport?.equipment || []
  );
  const [materials, setMaterials] = useState<MaterialEntry[]>(
    existingReport?.materials || []
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<DailyReportPhoto[]>(
    existingReport?.photos || []
  );
  const [notes, setNotes] = useState(existingReport?.notes || '');
  const [issues, setIssues] = useState<IssueEntry[]>(
    existingReport?.issues || []
  );
  const [subcontractors, setSubcontractors] = useState<SubcontractorEntry[]>(
    existingReport?.subcontractors || []
  );

  const calculateWorkHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    // Handle case where end time is next day (e.g., 23:00 to 02:00)
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return Math.max(0, Math.round(diffHours * 100) / 100); // Round to 2 decimal places
  };

  const addWorkLogEntry = () => {
    const newEntry: WorkLogEntry = {
      id: Date.now().toString(),
      crewMember: '',
      workPerformed: '',
      hoursWorked: 0,
      startTime: '',
      endTime: '',
      location: '',
      notes: ''
    };
    setWorkLog([...workLog, newEntry]);
  };

  const updateWorkLogEntry = (id: string, field: keyof WorkLogEntry, value: any) => {
    setWorkLog(workLog.map(entry => {
      if (entry.id === id) {
        const updatedEntry = { ...entry, [field]: value };
        
        // Auto-calculate hours when start or end time changes
        if (field === 'startTime' || field === 'endTime') {
          const startTime = field === 'startTime' ? value : entry.startTime;
          const endTime = field === 'endTime' ? value : entry.endTime;
          updatedEntry.hoursWorked = calculateWorkHours(startTime, endTime);
        }
        
        return updatedEntry;
      }
      return entry;
    }));
  };

  const removeWorkLogEntry = (id: string) => {
    setWorkLog(workLog.filter(entry => entry.id !== id));
  };

  const addSafetyCheck = () => {
    const newCheck: SafetyCheck = {
      id: Date.now().toString(),
      category: 'ppe',
      description: '',
      status: 'passed',
      notes: '',
      photos: []
    };
    setSafetyChecks([...safetyChecks, newCheck]);
  };

  const updateSafetyCheck = (id: string, field: keyof SafetyCheck, value: any) => {
    setSafetyChecks(safetyChecks.map(check => 
      check.id === id ? { ...check, [field]: value } : check
    ));
  };

  const removeSafetyCheck = (id: string) => {
    setSafetyChecks(safetyChecks.filter(check => check.id !== id));
  };

  const addEquipmentEntry = () => {
    const newEntry: EquipmentEntry = {
      id: Date.now().toString(),
      equipmentName: '',
      condition: 'excellent',
      hoursUsed: 0,
      fuelUsed: 0,
      maintenanceNotes: '',
      operator: ''
    };
    setEquipment([...equipment, newEntry]);
  };

  const updateEquipmentEntry = (id: string, field: keyof EquipmentEntry, value: any) => {
    setEquipment(equipment.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const removeEquipmentEntry = (id: string) => {
    setEquipment(equipment.filter(entry => entry.id !== id));
  };

  const addMaterialEntry = () => {
    const newEntry: MaterialEntry = {
      id: Date.now().toString(),
      materialName: '',
      quantity: 0,
      unit: 'pieces',
      supplier: '',
      deliveryTime: '',
      condition: 'excellent',
      notes: ''
    };
    setMaterials([...materials, newEntry]);
  };

  const updateMaterialEntry = (id: string, field: keyof MaterialEntry, value: any) => {
    setMaterials(materials.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const removeMaterialEntry = (id: string) => {
    setMaterials(materials.filter(entry => entry.id !== id));
  };

  const addIssueEntry = () => {
    const newEntry: IssueEntry = {
      id: Date.now().toString(),
      title: '',
      description: '',
      severity: 'low',
      category: 'other',
      status: 'open',
      assignedTo: '',
      assignedToName: '',
      dueDate: '',
      photos: [],
      resolution: '',
      resolvedAt: null,
      resolvedBy: ''
    };
    setIssues([...issues, newEntry]);
  };

  const updateIssueEntry = (id: string, field: keyof IssueEntry, value: any) => {
    setIssues(issues.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const removeIssueEntry = (id: string) => {
    setIssues(issues.filter(entry => entry.id !== id));
  };

  const addSubcontractorEntry = () => {
    const newEntry: SubcontractorEntry = {
      id: Date.now().toString(),
      companyName: '',
      workPerformed: '',
      crewSize: 0,
      hoursWorked: 0,
      contactPerson: '',
      contactPhone: '',
      notes: ''
    };
    setSubcontractors([...subcontractors, newEntry]);
  };

  const updateSubcontractorEntry = (id: string, field: keyof SubcontractorEntry, value: any) => {
    setSubcontractors(subcontractors.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const removeSubcontractorEntry = (id: string) => {
    setSubcontractors(subcontractors.filter(entry => entry.id !== id));
  };

  const handlePhotoUpload = async (files: FileList) => {
    setLoading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Compress image if option is enabled
        let fileToUpload = file;
        if (compressPhotos && file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file);
        }
        
        const storageRef = ref(storage, `daily-reports/${projectId}/${Date.now()}-${fileToUpload.name}`);
        const snapshot = await uploadBytes(storageRef, fileToUpload);
        const url = await getDownloadURL(snapshot.ref);
        return {
          id: Date.now().toString() + Math.random(),
          url,
          caption: file.name,
          category: 'general' as const,
          uploadedAt: new Date()
        } as DailyReportPhoto;
      });
      
      const newPhotos = await Promise.all(uploadPromises);
      setUploadedPhotos(prev => [...prev, ...newPhotos]);
      setPhotos(prev => [...prev, ...Array.from(files)]);
    } catch (error) {
      console.error('Error uploading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = (photoId: string) => {
    setUploadedPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  const handleSave = async (status: 'draft' | 'submitted' = 'draft') => {
    if (!currentUser) return;
    
    setSaving(true);
    try {
      const reportData: Omit<DailyReport, 'id'> = {
        projectId,
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Unknown User',
        userEmail: currentUser.email || '',
        reportDate,
        weather,
        workLog,
        safetyChecks,
        equipment,
        materials,
        photos: uploadedPhotos,
        notes,
        issues,
        subcontractors,
        status,
        submittedAt: status === 'submitted' ? serverTimestamp() : undefined,
        createdAt: existingReport?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      console.log('Saving report with photos:', uploadedPhotos);

      if (existingReport) {
        console.log('Updating existing daily report:', existingReport.id, reportData);
        await updateDoc(doc(db, 'dailyReports', existingReport.id), reportData);
        onSave({ ...existingReport, ...reportData });
      } else {
        console.log('Creating new daily report for project:', projectId, reportData);
        const docRef = await addDoc(collection(db, 'dailyReports'), reportData);
        console.log('Daily report created with ID:', docRef.id);
        onSave({ id: docRef.id, ...reportData });
      }
    } catch (error) {
      console.error('Error saving daily report:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {existingReport ? 'Edit Daily Report' : 'Create Daily Report'}
            </h2>
            <p className="text-gray-600 mt-1">
              {existingReport ? 'Update your daily report details' : 'Document today\'s progress and activities'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSave('draft')}
              disabled={saving}
              variant="outline"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              onClick={() => handleSave('submitted')}
              disabled={saving}
            >
              {saving ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>

        {/* Report Date */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Report Date</h3>
          <Input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {/* Weather */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Weather Conditions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            type="number"
            label="Temperature (°C)"
            placeholder="Enter temperature"
            value={weather.temperature || ''}
            onChange={(e) => setWeather({...weather, temperature: Number(e.target.value) || 0})}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Condition</label>
            <select
              value={weather.condition}
              onChange={(e) => setWeather({...weather, condition: e.target.value as any})}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base touch-manipulation min-h-[44px]"
            >
              <option value="sunny">☀️ Sunny</option>
              <option value="partly-cloudy">⛅ Partly Cloudy</option>
              <option value="cloudy">☁️ Cloudy</option>
              <option value="rainy">🌧️ Rainy</option>
              <option value="stormy">⛈️ Stormy</option>
              <option value="snowy">❄️ Snowy</option>
              <option value="foggy">🌫️ Foggy</option>
            </select>
          </div>
          <Input
            type="number"
            label="Wind Speed (km/h)"
            placeholder="Enter wind speed"
            value={weather.windSpeed || ''}
            onChange={(e) => setWeather({...weather, windSpeed: Number(e.target.value) || 0})}
          />
          <Input
            type="number"
            label="Humidity (%)"
            placeholder="Enter humidity"
            value={weather.humidity || ''}
            onChange={(e) => setWeather({...weather, humidity: Number(e.target.value) || 0})}
          />
        </div>
        <Input
          label="Weather Notes"
          placeholder="Additional weather observations..."
          value={weather.notes || ''}
          onChange={(e) => setWeather({...weather, notes: e.target.value})}
          className="mt-4"
        />
      </Card>

      {/* Work Log */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Work Log</h3>
          <Button onClick={addWorkLogEntry} size="sm">
            Add Entry
          </Button>
        </div>
        <div className="space-y-4">
          {workLog.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Row 1: Crew Member and Work Performed */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Crew Member</label>
                  <Input
                    placeholder="Enter crew member name"
                    value={entry.crewMember}
                    onChange={(e) => updateWorkLogEntry(entry.id, 'crewMember', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Work Performed</label>
                  <select
                    value={entry.workPerformed}
                    onChange={(e) => updateWorkLogEntry(entry.id, 'workPerformed', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base touch-manipulation min-h-[44px]"
                  >
                    <option value="">Select work performed...</option>
                    {projectTasks.map((task) => (
                      <option key={task.id} value={task.title}>
                        {task.title} ({task.status})
                      </option>
                    ))}
                    <option value="other">Other (specify in notes)</option>
                  </select>
                </div>

                {/* Row 2: Start Time and End Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <Input
                    type="time"
                    placeholder="Start Time"
                    value={entry.startTime}
                    onChange={(e) => updateWorkLogEntry(entry.id, 'startTime', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <Input
                    type="time"
                    placeholder="End Time"
                    value={entry.endTime}
                    onChange={(e) => updateWorkLogEntry(entry.id, 'endTime', e.target.value)}
                  />
                </div>

                {/* Row 3: Hours Worked and Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hours Worked (Auto-calculated)</label>
                  <input
                    type="number"
                    value={entry.hoursWorked || ''}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base touch-manipulation min-h-[44px] bg-gray-100"
                    readOnly
                    placeholder="Auto-calculated"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <Input
                    placeholder="Work location"
                    value={entry.location}
                    onChange={(e) => updateWorkLogEntry(entry.id, 'location', e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Input
                  placeholder="Additional work details..."
                  value={entry.notes || ''}
                  onChange={(e) => updateWorkLogEntry(entry.id, 'notes', e.target.value)}
                />
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => removeWorkLogEntry(entry.id)}
                  variant="danger"
                  size="sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove Entry
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Safety Checks */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Safety Checks</h3>
          <Button onClick={addSafetyCheck} size="sm">
            Add Check
          </Button>
        </div>
        <div className="space-y-4">
          {safetyChecks.map((check) => (
            <div key={check.id} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={check.category}
                  onChange={(e) => updateSafetyCheck(check.id, 'category', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ppe">PPE</option>
                  <option value="equipment">Equipment</option>
                  <option value="site-conditions">Site Conditions</option>
                  <option value="emergency">Emergency</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={check.status}
                  onChange={(e) => updateSafetyCheck(check.id, 'status', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="needs-attention">Needs Attention</option>
                </select>
              </div>
              <Input
                placeholder="Description"
                value={check.description}
                onChange={(e) => updateSafetyCheck(check.id, 'description', e.target.value)}
                className="mt-3"
              />
              <Input
                placeholder="Notes"
                value={check.notes || ''}
                onChange={(e) => updateSafetyCheck(check.id, 'notes', e.target.value)}
                className="mt-3"
              />
              <Button
                onClick={() => removeSafetyCheck(check.id)}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Equipment */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Equipment</h3>
          <Button onClick={addEquipmentEntry} size="sm">
            Add Equipment
          </Button>
        </div>
        <div className="space-y-4">
          {equipment.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Equipment Name"
                  value={entry.equipmentName}
                  onChange={(e) => updateEquipmentEntry(entry.id, 'equipmentName', e.target.value)}
                />
                <select
                  value={entry.condition}
                  onChange={(e) => updateEquipmentEntry(entry.id, 'condition', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="out-of-service">Out of Service</option>
                </select>
                <Input
                  type="number"
                  placeholder="Hours Used"
                  value={entry.hoursUsed || ''}
                  onChange={(e) => updateEquipmentEntry(entry.id, 'hoursUsed', Number(e.target.value) || 0)}
                />
                <Input
                  type="number"
                  placeholder="Fuel Used (L)"
                  value={entry.fuelUsed || ''}
                  onChange={(e) => updateEquipmentEntry(entry.id, 'fuelUsed', Number(e.target.value) || 0)}
                />
                <Input
                  placeholder="Operator"
                  value={entry.operator || ''}
                  onChange={(e) => updateEquipmentEntry(entry.id, 'operator', e.target.value)}
                />
              </div>
              <Input
                placeholder="Maintenance Notes"
                value={entry.maintenanceNotes || ''}
                onChange={(e) => updateEquipmentEntry(entry.id, 'maintenanceNotes', e.target.value)}
                className="mt-3"
              />
              <Button
                onClick={() => removeEquipmentEntry(entry.id)}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Materials */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Materials</h3>
          <Button onClick={addMaterialEntry} size="sm">
            Add Material
          </Button>
        </div>
        <div className="space-y-4">
          {materials.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Material Name"
                  value={entry.materialName}
                  onChange={(e) => updateMaterialEntry(entry.id, 'materialName', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={entry.quantity || ''}
                  onChange={(e) => updateMaterialEntry(entry.id, 'quantity', Number(e.target.value) || 0)}
                />
                <Input
                  placeholder="Unit"
                  value={entry.unit}
                  onChange={(e) => updateMaterialEntry(entry.id, 'unit', e.target.value)}
                />
                <select
                  value={entry.condition}
                  onChange={(e) => updateMaterialEntry(entry.id, 'condition', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="damaged">Damaged</option>
                </select>
                <Input
                  placeholder="Supplier"
                  value={entry.supplier || ''}
                  onChange={(e) => updateMaterialEntry(entry.id, 'supplier', e.target.value)}
                />
                <Input
                  type="time"
                  placeholder="Delivery Time"
                  value={entry.deliveryTime || ''}
                  onChange={(e) => updateMaterialEntry(entry.id, 'deliveryTime', e.target.value)}
                />
              </div>
              <Input
                placeholder="Notes"
                value={entry.notes || ''}
                onChange={(e) => updateMaterialEntry(entry.id, 'notes', e.target.value)}
                className="mt-3"
              />
              <Button
                onClick={() => removeMaterialEntry(entry.id)}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Issues */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Issues</h3>
          <Button onClick={addIssueEntry} size="sm">
            Add Issue
          </Button>
        </div>
        <div className="space-y-4">
          {issues.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Issue Title"
                  value={entry.title}
                  onChange={(e) => updateIssueEntry(entry.id, 'title', e.target.value)}
                />
                <select
                  value={entry.severity}
                  onChange={(e) => updateIssueEntry(entry.id, 'severity', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <select
                  value={entry.category}
                  onChange={(e) => updateIssueEntry(entry.id, 'category', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="safety">Safety</option>
                  <option value="quality">Quality</option>
                  <option value="schedule">Schedule</option>
                  <option value="cost">Cost</option>
                  <option value="other">Other</option>
                </select>
                <Input
                  type="date"
                  placeholder="Due Date"
                  value={entry.dueDate || ''}
                  onChange={(e) => updateIssueEntry(entry.id, 'dueDate', e.target.value)}
                />
              </div>
              <Input
                placeholder="Description"
                value={entry.description}
                onChange={(e) => updateIssueEntry(entry.id, 'description', e.target.value)}
                className="mt-3"
              />
              <Button
                onClick={() => removeIssueEntry(entry.id)}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Subcontractors */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Subcontractors</h3>
          <Button onClick={addSubcontractorEntry} size="sm">
            Add Subcontractor
          </Button>
        </div>
        <div className="space-y-4">
          {subcontractors.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Company Name"
                  value={entry.companyName}
                  onChange={(e) => updateSubcontractorEntry(entry.id, 'companyName', e.target.value)}
                />
                <Input
                  placeholder="Work Performed"
                  value={entry.workPerformed}
                  onChange={(e) => updateSubcontractorEntry(entry.id, 'workPerformed', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Crew Size"
                  value={entry.crewSize || ''}
                  onChange={(e) => updateSubcontractorEntry(entry.id, 'crewSize', Number(e.target.value) || 0)}
                />
                <Input
                  type="number"
                  placeholder="Hours Worked"
                  value={entry.hoursWorked || ''}
                  onChange={(e) => updateSubcontractorEntry(entry.id, 'hoursWorked', Number(e.target.value) || 0)}
                />
                <Input
                  placeholder="Contact Person"
                  value={entry.contactPerson || ''}
                  onChange={(e) => updateSubcontractorEntry(entry.id, 'contactPerson', e.target.value)}
                />
                <Input
                  placeholder="Contact Phone"
                  value={entry.contactPhone || ''}
                  onChange={(e) => updateSubcontractorEntry(entry.id, 'contactPhone', e.target.value)}
                />
              </div>
              <Input
                placeholder="Notes"
                value={entry.notes || ''}
                onChange={(e) => updateSubcontractorEntry(entry.id, 'notes', e.target.value)}
                className="mt-3"
              />
              <Button
                onClick={() => removeSubcontractorEntry(entry.id)}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Photos */}
      <Card className="p-4">
        <h3 className="text-lg font-medium mb-3">Photos</h3>
        <div className="mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={compressPhotos}
              onChange={(e) => setCompressPhotos(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Compress images (faster upload, smaller files)</span>
          </label>
        </div>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handlePhotoUpload(e.target.files)}
          className="w-full p-2 border border-gray-300 rounded-md touch-manipulation min-h-[44px]"
        />
        
        {uploadedPhotos.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Photos</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {uploadedPhotos.map((photo) => (
                <div key={photo.id} className="relative">
                  <img
                    src={photo.url}
                    alt={photo.caption}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                  <p className="text-xs text-gray-600 mt-1 truncate">{photo.caption}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {photos.length > 0 && (
          <div className="mt-3">
            <p className="text-sm text-gray-600 mb-2">
              {photos.length} photo(s) ready to upload
            </p>
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card className="p-4">
        <h3 className="text-lg font-medium mb-3">General Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes or observations..."
          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
        />
      </Card>
    </div>
  );
};

export default DailyReportForm;

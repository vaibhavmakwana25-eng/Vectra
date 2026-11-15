import Dexie from 'dexie';

export const db = new Dexie('VectraCNCDatabase');

db.version(1).stores({
  // 1. Site Visits & AI Knowledge Base
  siteVisits: '++id, date, customerName, location, machineType, controller, warranty, callPurpose, issue, solution, status, synced',
  
  // 2. Tooling & Cutting Data Trials
  toolingTrials: '++id, date, customerName, operation, material, dia, length, toolType, insertGrade, rpm, feed, doc, notes, synced',
  
  // 3. CNC Programs Repository
  programs: '++id, title, machineType, controller, operation, code, notes, createdAt, synced',

  // 4. Controller Parameters & Step-by-Step Guides
  parameters: '++id, controller, machineType, model, taskName, paramNumber, defaultValue, newValue, steps, notes, synced',

  // 5. Uploaded PDF Manuals & Extracted Pages Index
  manuals: '++id, title, controller, machineType, fileName, totalPages, uploadedAt',
  
  // 6. Daily Call & Task Logs (Multi-task per day)
  dailyLogs: '++id, date, time, logType, customerName, location, machineType, issue, solution, status, synced'
});
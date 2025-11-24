import * as fs from 'fs';
import * as path from 'path';

interface ScheduleRecord {
  scheduleId: number;
  beneficiary: string;
  amount: string;
  label: string;
  unlockTime: string;
}

interface ScheduleData {
  totalSchedules: number;
  firstScheduleId: number;
  lastScheduleId: number;
  unlockTime: string;
  deploymentDate: string;
  schedules: ScheduleRecord[];
}

async function saveScheduleIds() {
  try {
    // Read the vesting data
    const vestingDataPath = path.join(__dirname, '../script/data/vesting-data.json');
    const vestingData = JSON.parse(fs.readFileSync(vestingDataPath, 'utf-8'));

    console.log('📊 Creating schedule ID template...');

    // Create schedule data structure
    const scheduleData: ScheduleData = {
      totalSchedules: vestingData.records.length,
      firstScheduleId: 0, // Will be updated after deployment
      lastScheduleId: 0,   // Will be updated after deployment
      unlockTime: '2025-10-23T12:00:00.000Z',
      deploymentDate: new Date().toISOString(),
      schedules: vestingData.records.map((record: any, index: number) => ({
        scheduleId: 0, // Will be filled after deployment
        beneficiary: record.address,
        amount: record.amount,
        label: record.label,
        unlockTime: '2025-10-23T12:00:00.000Z'
      }))
    };

    // Save the template
    const outputPath = path.join(__dirname, '../script/data/schedule-ids.json');
    fs.writeFileSync(outputPath, JSON.stringify(scheduleData, null, 2), 'utf-8');

    console.log('✅ Schedule ID template created!');
    console.log('📄 File:', outputPath);
    console.log('📊 Total schedules:', scheduleData.totalSchedules);
    
    console.log('\n📝 Instructions:');
    console.log('1. Run the deployment script');
    console.log('2. Copy the schedule IDs from the console output');
    console.log('3. Update this JSON file with the actual schedule IDs');
    console.log('4. Use this file for tracking and verification');

  } catch (error) {
    console.error('❌ Error creating schedule template:', error);
    process.exit(1);
  }
}

// Run the script
saveScheduleIds();

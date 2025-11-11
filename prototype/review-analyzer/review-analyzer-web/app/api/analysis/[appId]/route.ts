import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  const { appId } = params;
  
  try {
    // Look for analysis files in the parent directory (where Python scripts are run)
    const parentDir = path.resolve(process.cwd(), '../');
    
    // Try to find the most recent analysis file for this app ID
    const files = fs.readdirSync(parentDir);
    const analysisFiles = files
      .filter(file => 
        file.startsWith(`${appId}_analysis_`) && 
        file.endsWith('.json')
      )
      .sort()
      .reverse(); // Get the most recent file
    
    if (analysisFiles.length === 0) {
      return NextResponse.json(
        { error: 'Analysis data not found' },
        { status: 404 }
      );
    }
    
    const filePath = path.join(parentDir, analysisFiles[0]);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const analysisData = JSON.parse(fileContent);
    
    // Return the analysis data
    return NextResponse.json(analysisData);
    
  } catch (error) {
    console.error('Error loading analysis data:', error);
    return NextResponse.json(
      { error: 'Failed to load analysis data' },
      { status: 500 }
    );
  }
}
import fs from 'fs/promises';
import path from 'path';

/**
 * Read team members from a text file (one per line)
 * @param {string} filePath - Path to the text file
 * @returns {Promise<string[]>} Array of member names
 */
export async function readMembersFromFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Split by lines, trim, and filter out empty lines
    const members = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (members.length === 0) {
      throw new Error('The file is empty or contains no valid member names');
    }
    
    return members;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}


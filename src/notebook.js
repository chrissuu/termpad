#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const readline = require('readline');

const NOTES_DIR = path.join(os.homedir(), '.notes');
const CONFIG_FILE = path.join(os.homedir(), '.notebook_config.json');

// Ensure notes directory exists
if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
}

// Load or create configuration
let config;
if (fs.existsSync(CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} else {
    config = {
        editor: process.env.EDITOR || 'vim',
        pager: process.env.PAGER || 'less'
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function createNote(notePath = '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const folderPath = path.join(NOTES_DIR, path.dirname(notePath));
    
    if (notePath) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    
    const filename = `note_${timestamp}.txt`;
    const filePath = path.join(folderPath, filename);
    
    execSync(`${config.editor} "${filePath}"`, { stdio: 'inherit' });
    
    if (fs.statSync(filePath).size > 0) {
        console.log(`Note saved as ${filePath}`);
    } else {
        fs.unlinkSync(filePath);
        console.log('Note was empty, deleting.');
    }
}

function listNotes(dirPath = '') {
    const fullPath = path.join(NOTES_DIR, dirPath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`Path not found: ${dirPath}`);
        return;
    }
    
    console.log(`Notes in ${dirPath || 'root'}:`);
    listNotesRecursive(fullPath, '', dirPath);
}

function listNotesRecursive(dir, prefix, relativePath) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    files.sort((a, b) => {
        return fs.statSync(path.join(dir, b.name)).mtime.getTime() - 
               fs.statSync(path.join(dir, a.name)).mtime.getTime();
    });
    
    files.forEach(file => {
        const filePath = path.join(dir, file.name);
        const relativeFilePath = path.join(relativePath, file.name);
        if (file.isDirectory()) {
            console.log(`${prefix}📁 ${relativeFilePath}/`);
            listNotesRecursive(filePath, prefix + '  ', relativeFilePath);
        } else {
            console.log(`${prefix}📄 ${relativeFilePath}`);
        }
    });
}

function viewNote(notePath) {
    const fullPath = path.join(NOTES_DIR, notePath);
    if (fs.existsSync(fullPath)) {
        execSync(`${config.pager} "${fullPath}"`, { stdio: 'inherit' });
    } else {
        console.log(`Note not found: ${notePath}`);
    }
}

function searchNotes(term, searchPath = '') {
    if (!term) {
        console.log('Please provide a search term.');
        return;
    }
    
    const fullSearchPath = path.join(NOTES_DIR, searchPath);
    console.log(`Searching for '${term}' in ${searchPath || 'all notes'}:`);
    const grep = process.platform === 'win32' ? 'findstr' : 'grep';
    try {
        const result = execSync(`${grep} -r -i "${term}" "${fullSearchPath}"`, { encoding: 'utf8' });
        console.log(result);
    } catch (error) {
        if (error.status === 1) {
            console.log('No matches found.');
        } else {
            console.error('An error occurred during the search.');
        }
    }
}

function deleteNote(notePath) {
    const fullPath = path.join(NOTES_DIR, notePath);
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Note deleted: ${notePath}`);
    } else {
        console.log(`Note not found: ${notePath}`);
    }
}

function editNote(notePath) {
    const fullPath = path.join(NOTES_DIR, notePath);
    if (fs.existsSync(fullPath)) {
        execSync(`${config.editor} "${fullPath}"`, { stdio: 'inherit' });
        console.log(`Note updated: ${notePath}`);
    } else {
        console.log(`Note not found: ${notePath}`);
    }
}

function createFolder(folderPath) {
    const fullPath = path.join(NOTES_DIR, folderPath);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Folder created: ${folderPath}`);
    } else {
        console.log(`Folder already exists: ${folderPath}`);
    }
}

function deleteFolder(folderPath) {
    const fullPath = path.join(NOTES_DIR, folderPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`Folder not found: ${folderPath}`);
        return;
    }

    const filesToDelete = [];
    const foldersToDelete = [];

    function scanDirectory(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const itemPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                foldersToDelete.push(itemPath);
                scanDirectory(itemPath);
            } else {
                filesToDelete.push(itemPath);
            }
        }
    }

    scanDirectory(fullPath);
    foldersToDelete.push(fullPath);

    console.log("The following items will be deleted:");
    filesToDelete.forEach(file => console.log(`File: ${path.relative(NOTES_DIR, file)}`));
    foldersToDelete.forEach(folder => console.log(`Folder: ${path.relative(NOTES_DIR, folder)}`));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question("Are you sure you want to delete this folder and all its contents? (y/N) ", (answer) => {
        if (answer.toLowerCase() === 'y') {
            filesToDelete.forEach(file => fs.unlinkSync(file));
            foldersToDelete.sort((a, b) => b.length - a.length).forEach(folder => fs.rmdirSync(folder));
            console.log(`Folder deleted: ${folderPath}`);
        } else {
            console.log("Deletion cancelled.");
        }
        rl.close();
    });
}

function editConfig() {
    execSync(`${config.editor} "${CONFIG_FILE}"`, { stdio: 'inherit' });
    console.log('Configuration updated. Please restart the app for changes to take effect.');
}

const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

switch (command) {
    case 'new':
        createNote(arg1);
        break;
    case 'list':
        listNotes(arg1);
        break;
    case 'view':
        viewNote(arg1);
        break;
    case 'search':
        searchNotes(arg1, arg2);
        break;
    case 'delete':
        deleteNote(arg1);
        break;
    case 'edit':
        editNote(arg1);
        break;
    case 'mkdir':
        createFolder(arg1);
        break;
    case 'rmdir':
        deleteFolder(arg1);
        break;
    case 'config':
        editConfig();
        break;
    default:
        console.log(`Usage: notebook [new [path]|list [path]|view <path>|search <term> [path]|delete <path>|edit <path>|mkdir <path>|rmdir <path>|config]
  new [path]        - Create a new note, optionally at a specific path
  list [path]       - List all notes, optionally from a specific path
  view <path>       - View a specific note
  search <term> [path] - Search notes for a term, optionally in a specific path
  delete <path>     - Delete a specific note
  edit <path>       - Edit an existing note
  mkdir <path>      - Create a new folder
  rmdir <path>      - Delete a folder and its contents
  config            - Edit configuration`);
}

/* eslint-disable @typescript-eslint/no-var-requires */
// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const spawn = require('node:child_process').spawn;
/**
 * Writes to file and returns promise
 *
 */
const renameFolder = (oldPath, newPath) => {
    return new Promise((resolve, reject) => {
        fs.rename(path.resolve(oldPath), path.resolve(newPath), (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

const deleteFolder = (folder) => {
    const delPath = path.resolve(folder);
    if (fs.existsSync(delPath)) {
        fs.readdirSync(delPath).forEach((file) => {
            const currentPath = path.resolve(delPath, `./${file}`);
            if (fs.lstatSync(currentPath).isDirectory()) {
                deleteFolder(currentPath);
            } else {
                fs.unlinkSync(currentPath);
            }
        });
        fs.rmdirSync(delPath);
    }
};

const readFile = (file) => {
    return new Promise((resolve, reject) => {
        fs.readFile(path.resolve(file), 'UTF8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

const readFiles = (folder) => {
    return new Promise((resolve, reject) => {
        fs.readdir(path.resolve(process.cwd(), folder), { withFileTypes: true }, (err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
};

const writeFile = (file, data) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(path.resolve(file), data, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

// @ts-check
const print = (color, comment, error) => {
    switch (color) {
        case 'green':
            color = '\x1b[32m';
            break;
        case 'white':
            color = '\x1b[37m';
            break;
        case 'red':
            color = '\x1b[31m';
            break;
        case 'blue':
            color = '\x1b[36m';
            break;
        case 'purple':
            color = '\x1b[35m';
            break;
        default:
            color = '\x1b[37m';
    }

    if (error) {
        // Use red always
        console.error('\x1b[31m', comment);
    } else {
        console.log(color, comment, '\x1b[37m');
    }
};

const logInfo = (comment, color = 'green') => {
    print(color, comment, false);
};

const logError = (comment) => {
    print('red', comment, true);
};

const spawner = (cmd, args, dirname, display = false) => {
    return new Promise((resolve, reject) => {
        const childSpawn = spawn(cmd, args, {
            stdio: display ? 'inherit' : 'ignore',
            cwd: dirname
        });
        // without this the promise never settles if the process fails to start
        childSpawn.on('error', reject);
        childSpawn.on('exit', (code) => {
            resolve(code);
        });
    });
};

module.exports = {
    renameFolder,
    readFile,
    writeFile,
    readFiles,
    deleteFolder,
    logInfo,
    spawner,
    logError,
    path
};

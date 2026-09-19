import fs from "fs/promises";
import child_process from "child_process";
import { dirname, resolve, join } from 'path';

async function findScaffoldsDir(startPath) {
  let currentPath = resolve(startPath);

  while (currentPath !== dirname(currentPath)) {
    const scaffoldsPath = resolve(currentPath, 'scaffolds');

    try {
      const stat = await fs.stat(scaffoldsPath);
      if (stat.isDirectory()) {
        return currentPath;
      }
    } catch (err) {
      // If the error is because the file/directory does not exist, continue to the parent directory
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    currentPath = dirname(currentPath);
  }

  return null;
}

async function checkFileAccessible(root, file) {
  try {
    await fs.access(join(root, file))
  } catch {
    return false
  }
  return true
}

export async function hoistDeps() {
  const hexoRoot = await findScaffoldsDir(process.cwd())
  if (!hexoRoot) throw new Error('Cannot find the Hexo root: run this tool inside the blog workspace.')
  let pm
  if (await checkFileAccessible(hexoRoot, 'pnpm-lock.yml') || await checkFileAccessible(hexoRoot, 'pnpm-lock.yaml') || await checkFileAccessible(hexoRoot, 'enable_pnpm')) {
    pm = "pnpm add"
  } else if (await checkFileAccessible(hexoRoot, 'yarn.lock') || await checkFileAccessible(hexoRoot, '.yarnrc.yml')) {
    pm = "yarn add"
  } else {
    pm = "npm install"
  }
  console.log(`Using ${pm} to hoist dependencies.`)
  // Resolve from this tool, not cwd: the caller may be in the blog root.
  const themePackage = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const deps = themePackage.dependencies || {}
  const depsList = Object.keys(deps).map(d => `${d}@${deps[d]}`)
  if (!depsList.length) {
    console.log('No theme dependencies to hoist.')
    return
  }
  await new Promise((resolve, reject) => {
    child_process.exec(`${pm} ${depsList.join(' ')}`, { cwd: hexoRoot }, (error, stdout, stderr) => {
      if (stdout) console.log(stdout)
      if (stderr) console.error(stderr)
      if (error) reject(error)
      else resolve()
    })
  })
}

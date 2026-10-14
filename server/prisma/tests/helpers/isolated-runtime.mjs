import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

const dockerContext = process.platform === 'win32' ? 'desktop-linux' : 'default'
const dockerPipe = 'dockerdesktoplinuxengine'

function localDockerCommand() {
  if (process.platform !== 'win32') return 'docker'
  const command = 'docker.exe'
  try {
    return execFileSync('where.exe', [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/).find(Boolean).trim()
  } catch {
    const standardPath = join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', command)
    if (existsSync(standardPath)) return standardPath
    throw new Error('No se encontró docker.exe. Instala o inicia Docker Desktop antes de ejecutar las suites.')
  }
}

function dockerEnv() {
  const env = { ...process.env }
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
  return env
}

function assertLocalDocker(env, dockerCommand) {
  const endpointsJson = execFileSync(dockerCommand, [
    '--context', dockerContext, 'context', 'inspect', dockerContext, '--format', '{{json .Endpoints}}',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env })
  const endpoint = JSON.parse(endpointsJson).docker.Host.toLowerCase()
  const isLocalWindowsDesktop = process.platform === 'win32'
    && endpoint === `npipe:////./pipe/${dockerPipe}`
  const isLocalUnixEngine = process.platform !== 'win32'
    && (endpoint === 'unix:///var/run/docker.sock' || endpoint.startsWith('unix:///'))
  assert.ok(isLocalWindowsDesktop || isLocalUnixEngine,
    `Docker context "${dockerContext}" no apunta al motor local permitido (endpoint: ${endpoint}).`)
}

export function runDocker(args, options = {}) {
  const dockerCommand = localDockerCommand()
  const env = dockerEnv()
  assertLocalDocker(env, dockerCommand)
  return execFileSync(dockerCommand, ['--context', dockerContext, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    ...options,
  }).trim()
}

export function createEmptyDotenv(tempRoot) {
  const file = join(tempRoot, 'qa-empty-dotenv')
  assert.equal(containsEnvFile(tempRoot), false, 'El sandbox no debe contener un archivo .env.')
  writeFileSync(file, '', { flag: 'wx' })
  return file
}

function containsEnvFile(directory) {
  return readdirSync(directory, { withFileTypes: true }).some(entry =>
    entry.name.toLowerCase() === '.env'
    || (entry.isDirectory() && containsEnvFile(join(directory, entry.name))))
}

export function copyMigrations(source, destination, excluded = []) {
  mkdirSync(destination, { recursive: true })
  for (const entry of readdirSync(source)) {
    if (entry !== '.env' && !excluded.includes(entry)) copyTree(join(source, entry), join(destination, entry))
  }
}

function copyTree(source, destination) {
  if (!statSync(source).isDirectory()) {
    cpSync(source, destination)
    return
  }
  const entries = readdirSync(source, { withFileTypes: true })
  mkdirSync(destination, { recursive: true })
  for (const entry of entries) {
    if (entry.name === '.env') continue
    const sourcePath = join(source, entry.name)
    const destinationPath = join(destination, entry.name)
    if (entry.isDirectory() || entry.isFile()) copyTree(sourcePath, destinationPath)
  }
}

export function createPrismaWorkspace({ tempRoot, name, schemaSource, migrationsSource, excludedMigrations = [] }) {
  const workspace = join(tempRoot, name)
  mkdirSync(workspace, { recursive: true })
  const root = resolve(tempRoot) + sep
  assert.ok(resolve(workspace).startsWith(root), 'El workspace de Prisma debe permanecer dentro del sandbox temporal.')
  const schemaPath = join(workspace, 'schema.prisma')
  cpSync(schemaSource, schemaPath)
  const migrationsPath = join(workspace, 'migrations')
  copyMigrations(migrationsSource, migrationsPath, excludedMigrations)
  assert.equal(containsEnvFile(workspace), false, 'El workspace de Prisma no debe contener archivos .env.')
  return { workspace, schemaPath, migrationsPath }
}

function assertDisposableUrl(value, description) {
  const url = new URL(value)
  const database = decodeURIComponent(url.pathname.slice(1))
  const knownLote2Database = ['fresh', 'shadow', 'upgrade', 'baseline', 'rollback'].includes(database)
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), `${description} debe ser PostgreSQL.`)
  assert.ok(url.hostname === '127.0.0.1' || url.hostname === 'localhost', `${description} debe apuntar a loopback.`)
  assert.equal(url.password, '', `${description} no debe contener contraseña.`)
  assert.match(url.username, /^qa_[a-z0-9_]+$/i, `${description} debe usar un usuario QA sintético.`)
  assert.ok(/^qa_[a-z0-9_]+$/i.test(database) || knownLote2Database,
    `${description} debe usar una base QA desechable reconocida.`)
}

export function runPrisma({ root, tempRoot, schemaPath, dotenvPath, databaseUrl, args }) {
  const sandbox = resolve(tempRoot) + sep
  const schema = resolve(schemaPath)
  const isolatedCwd = resolve(tempRoot, '..')
  assert.ok(schema.startsWith(sandbox), 'El schema Prisma debe estar dentro del sandbox temporal.')
  assert.equal(containsEnvFile(tempRoot), false, 'El sandbox de Prisma no debe contener archivos .env.')
  assert.equal(existsSync(join(isolatedCwd, '.env')), false, 'El cwd aislado de Prisma no debe contener un archivo .env.')
  assert.equal(existsSync(dotenvPath), true, 'Debe existir la configuración dotenv vacía del test.')
  assertDisposableUrl(databaseUrl, 'DATABASE_URL de Prisma')

  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--shadow-database-url') assertDisposableUrl(args[index + 1], 'Shadow database de Prisma')
    if (['--schema', '--from-schema-datasource', '--to-schema-datamodel', '--from-migrations'].includes(args[index])) {
      assert.ok(resolve(args[index + 1]).startsWith(sandbox), `${args[index]} debe apuntar dentro del sandbox temporal.`)
    }
  }

  const cli = join(root, 'server', 'node_modules', 'prisma', 'build', 'index.js')
  assert.equal(existsSync(cli), true, 'Falta el CLI JavaScript de Prisma en server/node_modules.')
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DOTENV_CONFIG_PATH: dotenvPath,
    NODE_ENV: 'test',
  }
  const prismaArgs = args[0] === 'migrate' && args[1] === 'diff'
    ? args.filter((argument, index) => argument !== '--schema' && args[index - 1] !== '--schema')
    : args
  return execFileSync(process.execPath, [cli, ...prismaArgs], {
    cwd: isolatedCwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  }).trim()
}

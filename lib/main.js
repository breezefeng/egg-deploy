const path = require('path')
const fs = require('fs')
const { promisify } = require('util')
const shell = require('shelljs')
const yml = require('js-yaml')
const NginxManager = require('nginx-upstream')
const cwd = process.cwd()
const { sleep, info, warn, error } = require('./util')

class Deploy {
  constructor(rawArgv) {
    this.service = {}
    this.rawArgv = rawArgv || process.argv.slice(2)
    this.config = {
      instances: [],
      startCommand: 'service nginx start',
      reloadCommand: 'nginx -s reload',
      nginxConfPath: 'nginx.conf',
      waitStopTime: 5000
    }
    this.check()
    this.registerService()
  }

  run() {
    const commandName = this.rawArgv[0]
    const rawArgv = this.rawArgv.slice()
    rawArgv.splice(rawArgv.indexOf(commandName), 1)
    const subCommand = this[commandName]
    if (!subCommand) {
      error(`[deploy info] ${commandName} command not found, exit`)
      this.exit(1)
    }
    this[commandName](commandName, rawArgv)
  }

  get nginxConfPath() {
    const { config } = this
    if (path.isAbsolute(config.nginxConfPath)) return config.nginxConfPath
    return path.join(cwd, config.nginxConfPath)
  }

  check() {
    const { config } = this
    const deployConfPath = path.join(cwd, '.deploy.yml')
    if (!fs.existsSync(deployConfPath)) {
      error('[deploy info] .deploy.yml not found, exit')
      this.exit(1)
    } else {
      const localConfig = yml.safeLoad(fs.readFileSync(deployConfPath, 'utf8'))
      localConfig && Object.assign(this.config, localConfig)
    }

    if (!fs.existsSync(this.nginxConfPath)) {
      error('[deploy info] nginx conf not found, exit')
      this.exit(1)
    }

    if (!config.instances.length) {
      info('[deploy info] no instances found, exit')
      this.exit(1);
    }

    if (config.instances.length === 1) {
      info('[deploy info] at least two instances are needed, exit')
      this.exit(1)
    }

    if (!shell.which('nginx')) {
      info('[deploy info] nginx not found, exit')
      this.exit(1)
    }
  }

  registerService() {
    const { config } = this
    const nginxManager = new NginxManager(this.nginxConfPath, 50)
    const names = ['backendList', 'addBackend', 'removeBackend', 'toggleBackend']

    names.forEach((name) => {
      this.service[name] = promisify(nginxManager[name]).bind(nginxManager)
    })
  }
  
  async start(commandName, rawArgv) {
    const { config, service } = this
    const list = await service.backendList()

    let shouldReload = false
    if (!list.length) {
      info('[deploy info] initializing, appending all upstream')
      for (let i = 0; i < config.instances.length; i++) {
        const instance = config.instances[i]
        try {
          await service.addBackend(`localhost:${instance.port}`)
        } catch (e) {
          console.log(e)
        }
      }
      shouldReload = true
    }

    if (shouldReload) {
      const reload = this.exec(config.reloadCommand)
      if (reload.code !== 0) {
        if (
          reload.stderr.includes('open() "/usr/local/var/run/nginx.pid" failed')
        ) {
          info('[deploy info] nginx is not started, try to start')
          const start = this.exec(config.startCommand)
        } else {
          info('[deploy info] nginx reload fail, exit')
          this.exit(1)
        }
      } else {
        info('[deploy info] nginx reloaded')
      }
    }

    for (let i = 0; i < config.instances.length; i++) {
      const instance = config.instances[i]

      // remove backend from nginx and reload
      info(`[deploy info] remove backend:${instance.title} from nginx`)
      try {
        await service.removeBackend(`localhost:${instance.port}`)
      } catch (e) {
        warn(`[deploy warn] instance:${instance.title} not found, ignore`)
      }
      info(`[deploy info] reload nginx`)
      this.exec(config.reloadCommand)

      // stop backend
      info(`[deploy info] wait ${config.waitStopTime}ms before stop backend`)
      await sleep(config.waitStopTime)
      this.exec(`npx egg-scripts stop --ignore-stderr --title=${instance.title}`)

      //start backend
      info(`[deploy info] start backend:${instance.title}`)
      const start = this.exec(
        `npx egg-scripts start ${rawArgv.join(' ')} --title=${instance.title} --port=${instance.port}`
      )

      if (start.code !== 0) {
        error(`[deploy error] start instance:${instance.title} fail, please check errors and fix it, exit`)
        this.exit(1)
      }

      try {
        await service.addBackend(`localhost:${instance.port}`)
      } catch (e) {
        console.log(e)
      }
      this.exec(config.reloadCommand)

      info(`[deploy info] instance:${instance.title} reload done`)
    }

  }

  stop(commandName, rawArgv) {
    const { config } = this
    for (let i = 0; i < config.instances.length; i++) {
      const instance = config.instances[i]
      this.exec(`npx egg-scripts stop --ignore-stderr --title=${instance.title}`)
    }
  }

  exit(code) {
    return shell.exit(code)
  }

  exec(cmd) {
    return shell.exec(cmd)
  }
}

module.exports = Deploy
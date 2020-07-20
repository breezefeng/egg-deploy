# egg-deploy

hot-deploy tool for egg project 

## Install

```bash
$ npm i @vivo/egg-deploy --save
```

## Usage

#### 1. add `.deploy.yml` config file in project root directory

- **Config arguments**

  - `instances` - application instance array, example:  `[{  port: 7008, title: 'egg-node-server'  }]`

  - `startCommand` - nginx start command, default: `service nginx start`

  - `reloadCommand` - nginx config reload, default: `nginx -s reload`

  - `waitStopTime` - waited time to stop application, default: `5000`

  - `nginxconcpath` -  nginx config file path, it is a relative path and also can a absolute path, for example `vre-node.conf`, but you must contain vre.conf file in nginx config file and reload nginx

  - ```nginx
    # vre-node.conf
    upstream vre-node {
      server localhost:7007;
      server localhost:7008;
    }
    ```

finally `.deploy.yml` like this, Example:

```yaml
instances:
 - 
  port: 7005
  title: egg-server-weekly-node-ts-2
 - 
  port: 7006
  title: egg-server-weekly-node-ts
nginxConfPath: /etc/nginx/upstream/weekly.conf
startCommand: service nginx start
reloadCommand: nginx -s reload
nginxConfPath: nginx.conf
waitStopTime: 5000
```

#### 2. add `egg-deploy` to `package.json` to scripts

```json
{
  "scripts": {
    "deploy": "egg-deploy start --env=prod --workers=2 --daemon",
    "stop": "egg-deploy stop"
  }
}
```

> additional: egg-deploy is based on egg-scripts, also have start and stop command,and has same arguments, but title and port is in .deploy.yml file, so don't repeat to write.


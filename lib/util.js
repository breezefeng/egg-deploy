const chalk = require('chalk')

const sleep = time => new Promise((resolve, reject) => {
  setTimeout(resolve, time)
})

const info = str => console.log(chalk.green(str))

const warn = str => console.log(chalk.yellow(str))

const error = str => console.log(chalk.red(str))

module.exports = {
  sleep,
  info,
  warn,
  error
}

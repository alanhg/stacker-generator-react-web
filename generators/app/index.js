const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const boxen = require('boxen');
const chalk = require('chalk');
const beeper = require('beeper');
const download = require('download-git-repo');
const Generator = require('yeoman-generator');
const updateNotifier = require('update-notifier');
const pkg = require('../../package.json');

const BOXEN_OPTS = {
  padding: 1,
  margin: 1,
  align: 'center',
  borderColor: 'yellow',
  borderStyle: 'round'
};
const APP_TYPE = {
  webpack: 'webpack'
};
const DEFAULT_DIR = 'react-app';
const GIT_BASE = 'https://github.com/';
const TPL_REPOSITORY = 'alanhg/react-front-web-template';
const ORA_SPINNER = {
  "interval": 80,
  "frames": [
    "   ⠋",
    "   ⠙",
    "   ⠚",
    "   ⠞",
    "   ⠖",
    "   ⠦",
    "   ⠴",
    "   ⠲",
    "   ⠳",
    "   ⠓"
  ]
};

module.exports = class extends Generator {

  getDefaultDir() {
    return `${this.type}-app`;
  }

  /**
   * 检查版本信息
   */
  checkVersion() {
    this.log();
    this.log(`🛠️  Checking your ${pkg.name} version...`);

    let checkResult = false;
    const notifier = updateNotifier({
      pkg,
      updateCheckInterval: 0
    });

    const update = notifier.update;
    if (update) {
      const messages = [];
      messages.push(
        `${chalk.bgYellow.black(' WARNI: ')}  ${pkg.name} is not latest.
`
      );
      messages.push(
        chalk.grey('current ')
        + chalk.grey(update.current)
        + chalk.grey(' → ')
        + chalk.grey('latest ')
        + chalk.green(update.latest)
      );
      messages.push(
        chalk.grey('Up to date ')
        + `npm i -g ${pkg.name}`
      );
      this.log(boxen(messages.join('\n'), BOXEN_OPTS));
      beeper();
      this.log(`🛠️  Finish checking your ${pkg.name}. CAUTION ↑↑`, '⚠️');
    } else {
      checkResult = true;
      this.log(`🛠️  Finish checking your ${pkg.name}. OK`, chalk.green('✔'));
    }

    return checkResult;
  }

  printEnvInfo() {
    this.log(chalk.grey('Environment Info:'))
    this.log(chalk.grey(`Node\t${process.version}`));
    this.log(chalk.grey(`PWD\t${process.cwd()}`));
  }

  initializing() {
    this.log();

    const version = `(v${pkg.version})`;
    const messages = [];
    messages.push(
      `💁 Welcome to use ${pkg.name} ${chalk.grey(version)}   `
    );
    this.log(
      boxen(messages.join('\n'), {
        ...BOXEN_OPTS,
        ...{
          borderColor: 'green',
          borderStyle: 'doubleSingle'
        }
      })
    );
    this.printEnvInfo();
    this.checkVersion();
  }

  _askForAppType() {
    const opts = [{
      type: 'list',
      name: 'type',
      choices: [{
        name: 'webpack (app based on webpack, webpack-cli, wds……)',
        value: APP_TYPE.webpack
      }],
      message: 'Please choose the build-tool for your project：',
      default: APP_TYPE.webpack
    }];

    return this.prompt(opts).then(({type}) => {
      this.type = type;
      this.dirName = this.getDefaultDir();
    });
  }

  askForDir() {
    const opts = [{
      type: 'input',
      name: 'dirName',
      message: 'Please enter the directory name for your project：',
      default: this.dirName,
      validate: dirName => {
        if (dirName.length < 1) {
          beeper();
          return '⚠️  directory name must not be null！';
        }
        return true;
      }
    }];

    return this.prompt(opts).then(({dirName}) => {
      this.dirName = dirName;
    });
  }

  askForOverwrite() {
    const destination = this.destinationPath();
    const dirName = this.dirName;
    if (!fs.existsSync(path.resolve(destination, dirName))) {
      return Promise.resolve();
    }

    const warn = chalk.grey('CAUTION! Files may be overwritten.');
    const opts = [{
      type: 'confirm',
      name: 'overwrite',
      message: `⚠️  Directory ${dirName} exists. Whether use this directory still? ${warn}`,
      default: false
    }];

    return this.prompt(opts).then(({overwrite}) => {
      if (!overwrite) {
        this.dirName = DEFAULT_DIR;
        return this.askDirFlow();
      }
    });
  }

  askDirFlow() {
    return this.askForDir().then(this.askForOverwrite);
  }

  /**
   * 获取用户输入
   */
  prompting() {
    this.log();
    this.log('⚙  Basic configuration...');
    const done = this.async();

    this._askForAppType()
      .then(this.askDirFlow)
      .then(done);
  }

  _walk(filePath, templateRoot) {
    if (fs.statSync(filePath).isDirectory()) {
      fs.readdirSync(filePath).forEach(name => {
        this._walk(path.resolve(filePath, name), templateRoot);
      });
      return;
    }

    const relativePath = path.relative(templateRoot, filePath);
    const destination = this.destinationPath(this.dirName, relativePath);
    this.fs.copyTpl(filePath, destination, {
      dirName: this.dirName
    });
  }

  _downloadTemplate(repository) {
    return new Promise((resolve, reject) => {
      const dirPath = this.destinationPath(this.dirName, '.tmp');
      download(repository, dirPath, null, err => err ? reject(err) : resolve());
    });
  }

  /**
   * 写入模版文件及目录
   */
  writing() {
    const done = this.async();
    const repository = TPL_REPOSITORY;

    this.log('⚙  Finish basic configuration.', chalk.green('✔'));
    this.log();
    this.log('📂 Generate the project template and configuration...');

    let spinner = ora({
      text: `Download the template from ${GIT_BASE}${repository}...`,
      spinner: ORA_SPINNER
    }).start();
    this._downloadTemplate(repository)
      .then(() => {
        spinner.stopAndPersist({
          symbol: chalk.green('   ✔'),
          text: `Finish downloading the template from ${GIT_BASE}${repository}`
        });

        spinner = ora({
          text: `Copy files into the project folder...`,
          spinner: ORA_SPINNER
        }).start();
        const templateRoot = this.destinationPath(this.dirName, '.tmp');
        this._walk(templateRoot, templateRoot);
        spinner.stopAndPersist({
          symbol: chalk.green('   ✔'),
          text: `Finish copying files into the project folder`
        });

        spinner = ora({
          text: `Clean tmp files and folders...`,
          spinner: ORA_SPINNER
        }).start();
        fs.removeSync(templateRoot);
        spinner.stopAndPersist({
          symbol: chalk.green('   ✔'),
          text: `Finish cleaning tmp files and folders`
        });
        done();
      })
      .catch(err => this.env.error(err));
  }

  /**
   * 安装npm依赖
   */
  install() {
    this.log();
    this.log('📂 Finish generating the project template and configuration.', chalk.green('✔'));
    this.log();
    this.log('📦 Install dependencies...');

    this.npmInstall('', {}, {
      cwd: this.destinationPath(this.dirName)
    });
  }

  end() {
    const dir = chalk.green(this.dirName);
    const info = `🎊 Create project successfully! Now you can enter ${dir} and start to code.`;
    this.log('📦 Finish installing dependencies.', chalk.green('✔'));
    this.log();
    this.log(
      boxen(info, {
        ...BOXEN_OPTS,
        ...{
          borderColor: 'white'
        }
      })
    );
  }
}


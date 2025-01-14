const t = require('tap')
const { fake: mockNpm } = require('../../fixtures/mock-npm')

const config = {
  registry: 'https://registry.npmjs.org/',
  scope: '',
}
const flatOptions = {
  registry: 'https://registry.npmjs.org/',
  scope: '',
}
const npm = mockNpm({ config, flatOptions })

const npmlog = {}

let result = null
const npmFetch = (url, opts) => {
  result = { url, opts }
}

const mocks = {
  npmlog,
  'npm-registry-fetch': npmFetch,
}

const Logout = t.mock('../../../lib/commands/logout.js', mocks)
const logout = new Logout(npm)

t.test('token logout', async (t) => {
  t.teardown(() => {
    delete flatOptions.token
    result = null
    mocks['npm-registry-fetch'] = null
    config.clearCredentialsByURI = null
    config.delete = null
    config.save = null
    npmlog.verbose = null
  })
  t.plan(5)

  flatOptions['//registry.npmjs.org/:_authToken'] = '@foo/'

  npmlog.verbose = (title, msg) => {
    t.equal(title, 'logout', 'should have correcct log prefix')
    t.equal(
      msg,
      'clearing token for https://registry.npmjs.org/',
      'should log message with correct registry'
    )
  }

  npm.config.clearCredentialsByURI = (registry) => {
    t.equal(
      registry,
      'https://registry.npmjs.org/',
      'should clear credentials from the expected registry'
    )
  }

  npm.config.save = (type) => {
    t.equal(type, 'user', 'should save to user config')
  }

  await logout.exec([])

  t.same(
    result,
    {
      url: '/-/user/token/%40foo%2F',
      opts: {
        registry: 'https://registry.npmjs.org/',
        scope: '',
        '//registry.npmjs.org/:_authToken': '@foo/',
        method: 'DELETE',
        ignoreBody: true,
      },
    },
    'should call npm-registry-fetch with expected values'
  )
})

t.test('token scoped logout', async (t) => {
  t.teardown(() => {
    config.scope = ''
    delete flatOptions['//diff-registry.npmjs.com/:_authToken']
    delete flatOptions['//registry.npmjs.org/:_authToken']
    delete config['@myscope:registry']
    delete flatOptions.scope
    result = null
    mocks['npm-registry-fetch'] = null
    config.clearCredentialsByURI = null
    config.delete = null
    config.save = null
    npmlog.verbose = null
  })
  t.plan(7)

  flatOptions['//diff-registry.npmjs.com/:_authToken'] = '@bar/'
  flatOptions['//registry.npmjs.org/:_authToken'] = '@foo/'
  config.scope = '@myscope'
  config['@myscope:registry'] = 'https://diff-registry.npmjs.com/'
  flatOptions.scope = '@myscope'
  flatOptions['@myscope:registry'] = 'https://diff-registry.npmjs.com/'

  npmlog.verbose = (title, msg) => {
    t.equal(title, 'logout', 'should have correcct log prefix')
    t.equal(
      msg,
      'clearing token for https://diff-registry.npmjs.com/',
      'should log message with correct registry'
    )
  }

  npm.config.clearCredentialsByURI = (registry) => {
    t.equal(
      registry,
      'https://diff-registry.npmjs.com/',
      'should clear credentials from the expected registry'
    )
  }

  npm.config.delete = (ref, type) => {
    t.equal(
      ref,
      '@myscope:registry',
      'should delete scoped registyr from config'
    )
    t.equal(type, 'user', 'should delete from user config')
  }

  npm.config.save = (type) => {
    t.equal(type, 'user', 'should save to user config')
  }

  await logout.exec([])

  t.same(
    result,
    {
      url: '/-/user/token/%40bar%2F',
      opts: {
        registry: 'https://registry.npmjs.org/',
        '@myscope:registry': 'https://diff-registry.npmjs.com/',
        scope: '@myscope',
        '//registry.npmjs.org/:_authToken': '@foo/', // <- removed by npm-registry-fetch
        '//diff-registry.npmjs.com/:_authToken': '@bar/',
        method: 'DELETE',
        ignoreBody: true,
      },
    },
    'should call npm-registry-fetch with expected values'
  )
})

t.test('user/pass logout', async (t) => {
  t.teardown(() => {
    delete flatOptions['//registry.npmjs.org/:username']
    delete flatOptions['//registry.npmjs.org/:_password']
    npm.config.clearCredentialsByURI = null
    npm.config.save = null
    npmlog.verbose = null
  })
  t.plan(2)

  flatOptions['//registry.npmjs.org/:username'] = 'foo'
  flatOptions['//registry.npmjs.org/:_password'] = 'bar'

  npmlog.verbose = (title, msg) => {
    t.equal(title, 'logout', 'should have correct log prefix')
    t.equal(
      msg,
      'clearing user credentials for https://registry.npmjs.org/',
      'should log message with correct registry'
    )
  }

  npm.config.clearCredentialsByURI = () => null
  npm.config.save = () => null

  await logout.exec([])
})

t.test('missing credentials', async t => {
  await t.rejects(
    logout.exec([]),
    { code: 'ENEEDAUTH', message: /not logged in to https:\/\/registry.npmjs.org\/, so can't log out!/ },
    'should throw with expected error code'
  )
})

t.test('ignore invalid scoped registry config', async (t) => {
  t.teardown(() => {
    delete flatOptions.token
    result = null
    mocks['npm-registry-fetch'] = null
    config.clearCredentialsByURI = null
    config.delete = null
    config.save = null
    npmlog.verbose = null
  })
  t.plan(4)

  flatOptions['//registry.npmjs.org/:_authToken'] = '@foo/'
  config.scope = '@myscope'
  flatOptions['@myscope:registry'] = ''

  npmlog.verbose = (title, msg) => {
    t.equal(title, 'logout', 'should have correcct log prefix')
    t.equal(
      msg,
      'clearing token for https://registry.npmjs.org/',
      'should log message with correct registry'
    )
  }

  npm.config.clearCredentialsByURI = (registry) => {
    t.equal(
      registry,
      'https://registry.npmjs.org/',
      'should clear credentials from the expected registry'
    )
  }

  npm.config.delete = () => null
  npm.config.save = () => null

  await logout.exec([])

  t.same(
    result,
    {
      url: '/-/user/token/%40foo%2F',
      opts: {
        '//registry.npmjs.org/:_authToken': '@foo/',
        registry: 'https://registry.npmjs.org/',
        '@myscope:registry': '',
        method: 'DELETE',
        ignoreBody: true,
      },
    },
    'should call npm-registry-fetch with expected values'
  )
})

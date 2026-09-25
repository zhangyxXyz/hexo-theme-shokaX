import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../source/js/_app/components/footer-comment-badge.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false
})
const { getFooterCommentBadge: badge } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
const friends = ['https://friend.example/', 'https://community.example/alice']
const cases = [
  ['missing metadata', {}, friends, 'Friend', undefined],
  ['nickname impersonation', { nick: 'Seiun', mail: 'owner@example.com' }, friends, 'Friend', undefined],
  ['nickname does not grant author status', { nick: 'Seiun', link: friends[0] }, friends, 'Friend', { text: 'Friend', kind: 'friend' }],
  ['administrator native label', { type: 'administrator', label: '  Author  ' }, friends, 'Friend', { text: 'Author', kind: 'author' }],
  ['administrator wins over friend', { type: 'administrator', label: 'Author', link: friends[0] }, friends, 'Friend', { text: 'Author', kind: 'author' }],
  ['administrator without label never becomes friend', { type: 'administrator', link: friends[0] }, friends, 'Friend', undefined],
  ['administrator blank label never becomes friend', { type: 'administrator', label: ' \n ', link: friends[0] }, friends, 'Friend', undefined],
  ['member native label wins over friend', { type: 'guest', label: '  Contributor  ', link: friends[0] }, friends, 'Friend', { text: 'Contributor', kind: 'member' }],
  ['native label without role', { label: 'Member' }, [], '', { text: 'Member', kind: 'member' }],
  ['label wording does not grant author role', { type: 'guest', label: 'Author' }, friends, 'Friend', { text: 'Author', kind: 'member' }],
  ['no role alias inference', { type: 'admin', label: 'Author' }, friends, 'Friend', { text: 'Author', kind: 'member' }],
  ['friend label is trimmed', { link: friends[0] }, friends, '  Friend  ', { text: 'Friend', kind: 'friend' }],
  ['bare hostname follows Waline normalization', { link: 'friend.example' }, friends, 'Friend', { text: 'Friend', kind: 'friend' }],
  ['bare hostname with path and surrounding whitespace', { link: '  community.example/alice/posts/1  ' }, friends, 'Friend', { text: 'Friend', kind: 'friend' }],
  ['protocol-relative website', { link: '//friend.example/posts/1' }, friends, 'Friend', { text: 'Friend', kind: 'friend' }],
  ['empty friend label is omitted', { link: friends[0] }, friends, ' \n ', undefined],
  ['blank native label permits friend fallback', { label: ' ', link: friends[0] }, friends, 'Friend', { text: 'Friend', kind: 'friend' }],
  ['friend subpath', { link: 'https://community.example/alice/posts/1' }, friends, 'Friend', { text: 'Friend', kind: 'friend' }],
  ['same host different user path', { link: 'https://community.example/bob' }, friends, 'Friend', undefined],
  ['similar path prefix is not friend', { link: 'https://community.example/alice-other' }, friends, 'Friend', undefined],
  ['lookalike host is not friend', { link: 'https://friend.example.evil.test/' }, friends, 'Friend', undefined],
  ['script URL is not friend', { link: 'javascript:alert(1)' }, friends, 'Friend', undefined],
  ['non-HTTP scheme is not normalized to a hostname', { link: 'javascript://friend.example/' }, friends, 'Friend', undefined],
  ['data scheme is not normalized to a hostname', { link: 'data:text/html,friend.example' }, friends, 'Friend', undefined],
  ['relative path is not a website', { link: '/friend.example' }, friends, 'Friend', undefined],
  ['empty configuration', { link: friends[0] }, [], 'Friend', undefined],
  ['text is returned literally for DOM textContent', { label: ' <b>Member</b> ' }, friends, 'Friend', { text: '<b>Member</b>', kind: 'member' }],
  ['non-string API label is ignored', { label: null, link: friends[0] }, friends, 'Friend', { text: 'Friend', kind: 'friend' }]
]

for (const [name, item, configuredFriends, friendLabel, expected] of cases) {
  assert.deepEqual(badge(item, configuredFriends, friendLabel), expected, name)
}
console.log(`Footer comment badges: ${cases.length} identity and URL cases passed.`)

const { getFooterLevelBadge: level } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
assert.equal(level({type:'administrator',level:4,label:'Author'},{},{},{},true),undefined)
assert.equal(level({type:'guest'},{}),undefined)
assert.equal(level({type:'guest',level:0,levelLabel:'Newcomer'},{level0:'Default'}).text,'Newcomer')
assert.equal(level({type:'guest',level:0,levelLabel:'Server'},{level0:'Default'},{level0:'Custom'}).text,'Custom')
assert.equal(level({type:'guest',level:1},{level1:'Regular'}).text,'Regular')
assert.equal(badge({type:'administrator',label:'Author',level:4},[],'Friend').text,'Author')
console.log('Footer levels: role exclusion, label priority and retained author badge passed.')

assert.equal(level({type:'administrator',level:4},{level4:'Veteran'},{},{},false).text,'Veteran')

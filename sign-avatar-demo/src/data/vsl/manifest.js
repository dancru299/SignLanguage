export const MVP_SCOPE = {
  productName: 'SignLanguage 3D Lab MVP',
  datasetVersion: 'vsl-mvp-0.1',
  officialTargetCount: 44,
  letterCount: 29,
  digitCount: 10,
  phraseCount: 5,
  firstPracticeBatch: ['chu_a', 'chu_b', 'chu_c', 'so_1', 'xin_chao'],
  acceptanceScore: 85,
  holdMs: 900,
}

export const SIGN_METADATA = [
  { token: 'chu_a', label: 'A', type: 'letter', mvpBatch: 1, authoringStatus: 'draft_seed' },
  { token: 'chu_b', label: 'B', type: 'letter', mvpBatch: 1, authoringStatus: 'draft_seed' },
  { token: 'chu_c', label: 'C', type: 'letter', mvpBatch: 1, authoringStatus: 'draft_seed' },
  { token: 'so_1', label: '1', type: 'digit', mvpBatch: 1, authoringStatus: 'draft_seed' },
  { token: 'xin_chao', label: 'Xin chào', type: 'phrase', mvpBatch: 1, authoringStatus: 'draft_seed' },
  { token: 'chu_d', label: 'D', type: 'letter', mvpBatch: 2, authoringStatus: 'seed' },
  { token: 'dung', label: 'Đúng', type: 'phrase', mvpBatch: 2, authoringStatus: 'seed' },
]

export const SIGN_METADATA_BY_TOKEN = new Map(
  SIGN_METADATA.map((item) => [item.token, item]),
)

export function isFirstPracticeToken(token) {
  return MVP_SCOPE.firstPracticeBatch.includes(token)
}


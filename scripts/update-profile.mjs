import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// GitHub Actions supplies the current owner, preventing future account renames from making counts stale.
export const owner = process.env.GITHUB_REPOSITORY_OWNER || 'Tyler-Keesee';
const start = '<!-- STATS:START -->';
const end = '<!-- STATS:END -->';

// Use the public /users endpoint, never the authenticated /user/repos endpoint.
export async function fetchPublicRepos(request = fetch) {
  const repos = [];
  for (let page = 1; ; page++) {
    const response = await request(`https://api.github.com/users/${owner}/repos?type=owner&per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `${owner}-profile`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}; keeping the previous snapshot.`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Expected a repository array.');
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}


export async function fetchStarredRepos(request = fetch) {
  const starred = [];
  for (let page = 1; page <= 100; page++) {
    const response = await request(`https://api.github.com/users/${owner}/starred?per_page=100&page=${page}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `${owner}-profile`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub starred API returned ${response.status}; preserving previous snapshot.`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Expected a starred repository array.');
    starred.push(...batch);
    if (batch.length < 100) return starred;
  }
  throw new Error('Starred repository pagination limit exceeded; preserving previous snapshot.');
}

export function summarize(repos, starredRepos = [], date = new Date()) {
  const publicRepos = repos.filter(repo => repo.private === false && repo.owner?.login?.toLowerCase() === owner.toLowerCase());
  const originals = publicRepos.filter(repo => !repo.fork);
  if (!publicRepos.length) throw new Error('No public repositories received; keeping the previous snapshot.');
  if (!Array.isArray(starredRepos)) throw new Error('Starred repository data unavailable; keeping the previous snapshot.');
  return { publicRepos: publicRepos.length, originals: originals.length,
    starred: starredRepos.length,
    starsReceived: originals.reduce((sum, repo) => sum + (repo.stargazers_count ?? 0), 0),
    date: date.toISOString().slice(0, 10) };
}

export function updateReadme(readme, stats) {
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(start) > readme.indexOf(end)) {
    throw new Error('README must contain one ordered pair of stats markers.');
  }
  const text = `**${stats.publicRepos} public repositories · ${stats.starred} repositories starred · ${stats.starsReceived} stars received**  \nUpdated ${stats.date} (UTC).`;
  return readme.slice(0, readme.indexOf(start) + start.length) + `\n${text}\n` + readme.slice(readme.indexOf(end));
}

export function renderSnapshot(stats) {
  const metrics = [[48, stats.publicRepos, 'PUBLIC REPOSITORIES'], [370, stats.starred, 'REPOSITORIES STARRED'], [692, stats.starsReceived, 'STARS RECEIVED']];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="204" viewBox="0 0 1000 204" role="img" aria-labelledby="title desc">
  <title id="title">${owner} public GitHub snapshot</title>
  <desc id="desc">${stats.publicRepos} public repositories, ${stats.starred} repositories starred, ${stats.starsReceived} stars received. Updated ${stats.date} UTC.</desc>
  <rect x="1" y="1" width="998" height="202" rx="16" fill="#0e1822" stroke="#29434c"/>
  <g font-family="Segoe UI,Arial,sans-serif">
    <text x="48" y="34" fill="#94b5bd" font-size="12" letter-spacing="2">PUBLIC WORK / GITHUB</text>
    ${metrics.map(([x, value, label]) => `<text x="${x}" y="108" fill="#77e9d0" font-size="48" font-weight="700">${value}</text><text x="${x}" y="138" fill="#b4c6d0" font-size="12" letter-spacing="1">${label}</text>`).join('\n    ')}
    <text x="48" y="181" fill="#94b5bd" font-size="12">LAST REFRESH ${stats.date} UTC · PUBLIC API SNAPSHOT</text>
  </g>
  <path d="M338 65v82M660 65v82" stroke="#29434c"/>
</svg>\n`;
}

export async function updateProfile(repos, starredRepos) {
  const stats = summarize(repos, starredRepos);
  const readmePath = resolve(root, 'README.md');
  const readme = updateReadme(await readFile(readmePath, 'utf8'), stats);
  const svg = renderSnapshot(stats);
  // Fetch and validate everything before writing; API failures preserve the last success.
  await writeFile(resolve(root, 'assets/github-snapshot.svg'), svg);
  await writeFile(readmePath, readme);
  console.log(`Updated public snapshot for ${stats.date}: ${stats.publicRepos} repositories.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = process.argv.indexOf('--from-json');
  const data = fixture === -1
    ? { repos: await fetchPublicRepos(), starredRepos: await fetchStarredRepos() }
    : JSON.parse(await readFile(process.argv[fixture + 1], 'utf8'));
  if (!Array.isArray(data.repos) || !Array.isArray(data.starredRepos)) {
    throw new Error('Offline snapshot needs { repos: [...], starredRepos: [...] }.');
  }
  await updateProfile(data.repos, data.starredRepos);
}

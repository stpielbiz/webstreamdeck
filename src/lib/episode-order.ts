/** True when episode `a` comes before episode `b` in a show's running order. */
export function isEarlierEpisode(a: { season: number; episode: number }, b: { season: number; episode: number }): boolean {
  return a.season < b.season || (a.season === b.season && a.episode < b.episode);
}

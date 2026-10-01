CREATE OR REPLACE FUNCTION public.popular_titles(_kind public.item_kind, _days integer DEFAULT 7, _lim integer DEFAULT 10)
RETURNS TABLE(title text, poster_url text, viewers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT min(w.title) AS title, max(w.poster_url) AS poster_url, count(DISTINCT w.user_id) AS viewers
  FROM public.watch_progress w
  WHERE auth.uid() IS NOT NULL
    AND w.updated_at > now() - make_interval(days => LEAST(GREATEST(_days,1),30))
    AND w.item_kind = CASE WHEN _kind = 'series' THEN 'episode'::public.item_kind ELSE _kind END
  GROUP BY lower(trim(CASE WHEN _kind = 'series' THEN coalesce(nullif(split_part(w.title,' - S',1),''), w.title) ELSE w.title END))
  ORDER BY viewers DESC, max(w.updated_at) DESC
  LIMIT LEAST(GREATEST(_lim,1),20)
$$;
REVOKE EXECUTE ON FUNCTION public.popular_titles(public.item_kind, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.popular_titles(public.item_kind, integer, integer) TO authenticated;
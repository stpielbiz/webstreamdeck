CREATE OR REPLACE FUNCTION public.popular_titles(_kind public.item_kind, _days integer DEFAULT 7, _lim integer DEFAULT 10)
RETURNS TABLE(title text, poster_url text, viewers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH t AS (
    SELECT CASE WHEN _kind = 'series' THEN regexp_replace(w.title, '\s+[—-]\s+S\d+.*$', '') ELSE w.title END AS name,
           w.poster_url, w.user_id, w.updated_at
    FROM public.watch_progress w
    WHERE auth.uid() IS NOT NULL
      AND w.updated_at > now() - make_interval(days => LEAST(GREATEST(_days,1),30))
      AND w.item_kind = CASE WHEN _kind = 'series' THEN 'episode'::public.item_kind ELSE _kind END
  )
  SELECT min(name), max(poster_url), count(DISTINCT user_id)
  FROM t GROUP BY lower(trim(name))
  ORDER BY 3 DESC, max(updated_at) DESC
  LIMIT LEAST(GREATEST(_lim,1),20)
$$;
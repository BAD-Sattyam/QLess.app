DO $d$
declare def text;
begin
  def := pg_get_functiondef('public.place_order(uuid,text,text,timestamptz,jsonb,text)'::regprocedure);
  def := replace(def, E'declare\n  c public.cafes;', E'#variable_conflict use_column\ndeclare\n  c public.cafes;');
  if position('#variable_conflict' in def) = 0 then raise exception 'patch failed'; end if;
  execute def;
end $d$;
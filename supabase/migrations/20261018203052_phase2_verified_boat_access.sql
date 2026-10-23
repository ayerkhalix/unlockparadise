-- Existing imported accessibility data explicitly identifies Boat as the sole mode.
-- No generic travel_minutes value is reinterpreted as a boat or road duration.
update public.place_details d
set boat_required = true
from public.places p
where p.id = d.place_id and p.accessibility = array['Boat']::text[]
  and not d.boat_required;

-- Copy access-point names only when the original description contains that exact name.
-- All original descriptions, links, fees, warnings, and duration text remain intact.
update public.place_details d
set departure_port = case
  when d.description like '%Honda Bay Wharf%' then 'Honda Bay Wharf'
  when d.description like '%Sabang Wharf%' then 'Sabang Wharf'
  when d.description like '%Manalo Beach%' then 'Manalo Beach'
  when d.description like '%Buenavista Beach%' then 'Buenavista Beach'
  when d.description like '%Tagkawayan Nanka%' then 'Tagkawayan Nanka'
  when d.description like '%Tagka-nanka%' then 'Tagka-nanka'
  else null end
from public.places p
where p.id=d.place_id and p.accessibility=array['Boat']::text[]
  and d.departure_port is null;

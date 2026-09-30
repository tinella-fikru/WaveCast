export interface Station {
  stationuuid: string;
  name: string;
  favicon: string;
  url_resolved: string;
  url?: string;
  homepage?: string;
  country: string;
  countrycode?: string;
  tags: string;
  bitrate: number;
  language?: string;
  clickcount?: number;
  geo_lat?: number | null;
  geo_long?: number | null;
}

export interface SavedStation {
  id: string;
  user_id: string;
  station_uuid: string;
  station_name: string;
  station_favicon: string;
  station_url: string;
  created_at: string;
  played_at?: string;
}

export interface MetadataProvider {
  subscribe(
    station: Station,
    onTitle: (title: string | null) => void,
  ): () => void;
}

export function fromSaved(row: SavedStation): Station {
  return {
    stationuuid: row.station_uuid,
    name: row.station_name,
    favicon: row.station_favicon,
    url_resolved: row.station_url,
    country: "",
    tags: "",
    bitrate: 0,
  };
}

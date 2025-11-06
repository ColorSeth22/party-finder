import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import TAGS from '../data/tags';
import useGeolocation from '../hooks/useGeolocation';

type Location = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  rating: number;
};

type Props = {
  onAdd: (newLocation: Location) => void;
};

const AddLocationForm = ({ onAdd }: Props) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [rating, setRating] = useState('');
  const [searchError, setSearchError] = useState('');
  const { coords, error: geoError } = useGeolocation();

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleGeocodeSearch = async () => {
    if (!address) return;
    setSearchError('');
    setIsGeocoding(true);

    try {
      // Build search URL with viewbox if we have user location
      const searchUrl = 'https://nominatim.openstreetmap.org/search';
      // Base search parameters
      const params = new URLSearchParams({
        format: 'json',
        q: address,
        limit: '5',
        addressdetails: '1',
        'accept-language': 'en'
      });

      // If we have user coordinates, strongly bias to their area
      if (coords) {
        // Add user's location as the search center
        params.append('lat', coords.latitude.toString());
        params.append('lon', coords.longitude.toString());
        
        // Set a search radius of ~25km (25000 meters)
        params.append('radius', '25000');

        // Add geographic bounds (~50km box) as a secondary filter
        const offset = 0.45; // roughly 50km at most latitudes
        params.append(
          'viewbox',
          `${coords.longitude - offset},${coords.latitude - offset},${
            coords.longitude + offset
          },${coords.latitude + offset}`
        );

        // Add state/area bias for US locations
        params.append('q', `${address} Iowa`);
      }

      const res = await fetch(`${searchUrl}?${params}`, {
        headers: {
          'Accept': 'application/json',
          // Add a proper User-Agent as requested by Nominatim
          'User-Agent': 'QuietLocations/1.0'
        }
      });

      if (!res.ok) {
        throw new Error(`Search failed with status: ${res.status}`);
      }

      const results = await res.json();

      if (Array.isArray(results) && results.length > 0) {
        const firstResult = results[0];
        if (typeof firstResult.lat === 'string' && typeof firstResult.lon === 'string') {
          setLat(firstResult.lat);
          setLng(firstResult.lon);
          // Update address with the found place name if it's a general search
          if (address.length < 20 && firstResult.display_name) {
            setAddress(firstResult.display_name);
          }
        } else {
          throw new Error('Invalid location data received');
        }
      } else {
        setSearchError('No locations found. Try being more specific.');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setSearchError(
        err instanceof Error 
          ? `Search failed: ${err.message}`
          : 'Failed to find location. Please try again.'
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  const generateUniqueId = (name: string) => {
    // Create a base from the name (first 20 chars max)
    const nameBase = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 20);
    
    // Add timestamp and random string
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    
    return `${nameBase}-${timestamp}-${random}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newLocation: Location = {
      id: generateUniqueId(name),
      name: name.trim(),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      tags: selectedTags,
      rating: parseFloat(rating) || 0,
    };

    onAdd(newLocation);

    // Reset form
    setName('');
    setLat('');
    setLng('');
    setAddress('');
    setSelectedTags([]);
    setRating('');
    setSearchError('');
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, maxWidth: 480 }}>
      <Typography variant="h6" gutterBottom>
        Add New Location
      </Typography>

      {geoError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {geoError}. Location search might be less accurate.
        </Alert>
      )}

      <Stack spacing={2}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />

        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, city, state or place name"
            helperText={searchError || (coords ? "Using your location to find places nearby" : "")}
            error={!!searchError}
            fullWidth
          />
          <Button
            variant="contained"
            onClick={handleGeocodeSearch}
            disabled={!address || isGeocoding}
            startIcon={isGeocoding ? <CircularProgress size={20} /> : <LocationOnIcon />}
            sx={{ mt: 1, minWidth: 100 }}
          >
            {isGeocoding ? 'Finding…' : 'Find'}
          </Button>
        </Stack>

        {(lat && lng) && (
          <Stack direction="row" spacing={2}>
            <TextField
              label="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
              fullWidth
              type="number"
              inputProps={{ step: 'any' }}
            />
            <TextField
              label="Longitude"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
              fullWidth
              type="number"
              inputProps={{ step: 'any' }}
            />
          </Stack>
        )}

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tags
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {TAGS.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                clickable
                color={selectedTags.includes(tag) ? 'primary' : 'default'}
                onClick={() => toggleTag(tag)}
                sx={{ m: 0.5 }}
              />
            ))}
          </Stack>
        </Box>

        <TextField
          label="Rating (1–5)"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          type="number"
          inputProps={{ step: '0.1', min: 1, max: 5 }}
        />

        <Button 
          type="submit" 
          variant="contained" 
          fullWidth
          disabled={!lat || !lng || !name}
        >
          Add Location
        </Button>
      </Stack>
    </Box>
  );
};

export default AddLocationForm;

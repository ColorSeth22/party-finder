import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import TAGS from '../data/tags';

// API base URL (should match App.tsx)
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:4000';

type Props = {
  locations: {
    id: string;
    name: string;
    tags: string[];
  }[];
  onUpdateTags: (id: string, newTags: string[]) => void;
};

const UpdateLocationForm = ({ locations, onUpdateTags }: Props) => {
  const [selectedId, setSelectedId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedLocation = locations.find((l) => l.id === selectedId);

  useEffect(() => {
    const loc = locations.find((l) => l.id === selectedId);
    setSelectedTags(loc ? loc.tags : []);
  }, [selectedId, locations]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleUpdate = () => {
    if (!selectedId) return;
    onUpdateTags(selectedId, selectedTags);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/locations/${selectedId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        // Refresh the page or update the locations list
        window.location.reload();
      } else {
        console.error('Failed to delete location');
      }
    } catch (err) {
      console.error('Error deleting location:', err);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Typography variant="h6" gutterBottom>
        Update or Delete Location
      </Typography>

      <Stack spacing={2}>
        <Select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value as string)}
          displayEmpty
        >
          <MenuItem value="">Select a location</MenuItem>
          {locations.map((loc) => (
            <MenuItem key={loc.id} value={loc.id}>
              {loc.name}
            </MenuItem>
          ))}
        </Select>

        {selectedId && (
          <>
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

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Button
                variant="contained"
                color="primary"
                onClick={handleUpdate}
                startIcon={<SaveIcon />}
                sx={{ flex: 1 }}
              >
                Update Tags
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setDeleteDialogOpen(true)}
                startIcon={<DeleteIcon />}
              >
                Delete
              </Button>
            </Stack>
          </>
        )}
      </Stack>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Delete Location?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{selectedLocation?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            color="primary"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            disabled={isDeleting}
            autoFocus
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UpdateLocationForm;

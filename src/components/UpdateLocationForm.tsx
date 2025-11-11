import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TAGS from '../data/tags';

type Event = {
	id: string;
	title: string;
	description: string | null;
	host_type: 'fraternity' | 'house' | 'club';
	location_lat: number;
	location_lng: number;
	start_time: string;
	end_time: string | null;
	tags: string[];
	theme: string | null;
	music_type: string | null;
	cover_charge: string | null;
	is_byob: boolean;
	is_active: boolean;
	created_by: string;
};

type Props = {
	events: Event[];
	currentUserId: string | null;
	onUpdateEvent: (id: string, updates: Partial<Event>) => Promise<boolean>;
};

const UpdateLocationForm = ({ events, currentUserId, onUpdateEvent }: Props) => {
	const myEvents = useMemo(() => {
		if (!currentUserId) return [] as Event[];
		return events.filter((event) => event.created_by === currentUserId);
	}, [events, currentUserId]);

	const [selectedId, setSelectedId] = useState<string>('');
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [theme, setTheme] = useState('');
	const [musicType, setMusicType] = useState('');
	const [coverCharge, setCoverCharge] = useState('');
	const [isByob, setIsByob] = useState(false);
	const [isActive, setIsActive] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	const selectedEvent = useMemo(() => myEvents.find((event) => event.id === selectedId) ?? null, [myEvents, selectedId]);

	useEffect(() => {
		if (!selectedEvent) {
			setTitle('');
			setDescription('');
			setSelectedTags([]);
			setTheme('');
			setMusicType('');
			setCoverCharge('');
			setIsByob(false);
			setIsActive(true);
			return;
		}

		setTitle(selectedEvent.title ?? '');
		setDescription(selectedEvent.description ?? '');
		setSelectedTags(selectedEvent.tags ?? []);
		setTheme(selectedEvent.theme ?? '');
		setMusicType(selectedEvent.music_type ?? '');
		setCoverCharge(selectedEvent.cover_charge ?? '');
		setIsByob(selectedEvent.is_byob);
		setIsActive(selectedEvent.is_active);
	}, [selectedEvent]);

	const toggleTag = (tag: string) => {
		setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
	};

	const hasChanges = useMemo(() => {
		if (!selectedEvent) return false;
		return (
			title !== (selectedEvent.title ?? '') ||
			description !== (selectedEvent.description ?? '') ||
			theme !== (selectedEvent.theme ?? '') ||
			musicType !== (selectedEvent.music_type ?? '') ||
			coverCharge !== (selectedEvent.cover_charge ?? '') ||
			isByob !== selectedEvent.is_byob ||
			isActive !== selectedEvent.is_active ||
			selectedTags.sort().join('|') !== (selectedEvent.tags ?? []).slice().sort().join('|')
		);
	}, [selectedEvent, title, description, theme, musicType, coverCharge, isByob, isActive, selectedTags]);

	const handleSave = async () => {
		if (!selectedEvent || !hasChanges) return;
		setIsSaving(true);
		try {
			const updates: Partial<Event> = {
				title,
				description: description || null,
				tags: selectedTags,
				theme: theme || null,
				music_type: musicType || null,
				cover_charge: coverCharge || null,
				is_byob: isByob,
				is_active: isActive
			};

			await onUpdateEvent(selectedEvent.id, updates);
		} finally {
			setIsSaving(false);
		}
	};

	if (!currentUserId) {
		return <Alert severity="info">Sign in to manage the events you are hosting.</Alert>;
	}

	if (!myEvents.length) {
		return <Alert severity="info">You have not published any events yet. Create one to start managing it here.</Alert>;
	}

	return (
		<Box sx={{ p: 2, maxWidth: 640 }}>
			<Stack spacing={3}>
				<Box>
					<Typography variant="h5" sx={{ fontWeight: 600 }} gutterBottom>
						Manage My Events
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Update party details, tags, and visibility. Changes apply instantly for everyone viewing the map.
					</Typography>
				</Box>

				<Select
					value={selectedId}
					onChange={(event) => setSelectedId(event.target.value as string)}
					displayEmpty
				>
					<MenuItem value="">Select an event to edit</MenuItem>
					{myEvents.map((event) => (
						<MenuItem key={event.id} value={event.id}>
							{event.title}
						</MenuItem>
					))}
				</Select>

				{selectedEvent && (
					<Stack spacing={3}>
						<Box>
							<Typography variant="subtitle2" color="text.secondary" gutterBottom>
								Scheduling
							</Typography>
							<Typography variant="body2">
								Starts {new Date(selectedEvent.start_time).toLocaleString()}<br />
								{selectedEvent.end_time ? `Ends ${new Date(selectedEvent.end_time).toLocaleString()}` : 'End time not set'}
							</Typography>
						</Box>

						<Divider />

						<TextField
							label="Event title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							fullWidth
						/>

						<TextField
							label="Description"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							fullWidth
							multiline
							minRows={3}
						/>

						<Box>
							<Typography variant="subtitle2" color="text.secondary" gutterBottom>
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
										sx={{ mb: 1 }}
									/>
								))}
							</Stack>
						</Box>

						<Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
							<TextField
								label="Theme"
								value={theme}
								onChange={(event) => setTheme(event.target.value)}
								fullWidth
							/>
							<TextField
								label="Music"
								value={musicType}
								onChange={(event) => setMusicType(event.target.value)}
								fullWidth
							/>
						</Stack>

						<TextField
							label="Cover charge"
							value={coverCharge}
							onChange={(event) => setCoverCharge(event.target.value)}
							fullWidth
						/>

						<Stack direction="row" spacing={2}>
							<FormControlLabel
								control={<Switch checked={isByob} onChange={(event, checked) => setIsByob(checked)} />}
								label="BYOB allowed"
							/>
							<FormControlLabel
								control={<Switch checked={isActive} onChange={(event, checked) => setIsActive(checked)} />}
								label="Show on map"
							/>
						</Stack>

						<Stack direction="row" spacing={2} justifyContent="flex-end">
							<Button
								variant="contained"
								onClick={handleSave}
								disabled={!hasChanges || isSaving}
							>
								{isSaving ? 'Saving...' : 'Save changes'}
							</Button>
						</Stack>
					</Stack>
				)}
			</Stack>
		</Box>
	);
};

export default UpdateLocationForm;

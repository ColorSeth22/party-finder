import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import CelebrationIcon from '@mui/icons-material/Celebration';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import PlaceIcon from '@mui/icons-material/Place';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import useGeolocation from '../hooks/useGeolocation';
import { getDistanceKm, formatDistance } from '../utils/distance';
import { useSettings } from '../contexts/settings/hooks';

type Event = {
	id: string;
	title: string;
	description: string | null;
	host_type: 'fraternity' | 'house' | 'club';
	location_lat: number;
	location_lng: number;
	start_time: string;
	end_time: string | null;
	tags: string[] | null;
	theme: string | null;
	music_type: string | null;
	cover_charge: string | null;
	is_byob: boolean;
	is_active: boolean;
};

type Props = {
	events: Event[];
	favoriteIds: Set<string>;
	onToggleFavorite: (eventId: string) => void | Promise<void>;
	pendingFavoriteId?: string | null;
	onCheckIn?: (eventId: string) => void | Promise<void>;
	pendingCheckInId?: string | null;
};

type EventWithDistance = Event & {
	distanceKm: number | null;
};

const HOST_LABELS: Record<Event['host_type'], string> = {
	fraternity: 'Fraternity/Greek',
	house: 'House Party',
	club: 'Campus Club'
};

const NearbyLocations = ({
	events,
	favoriteIds,
	onToggleFavorite,
	pendingFavoriteId,
	onCheckIn,
	pendingCheckInId
}: Props) => {
	const { coords, loading: locationLoading, error: locationError, refetch } = useGeolocation();
	const { distanceUnit } = useSettings();
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const decoratedEvents = useMemo<EventWithDistance[]>(() => {
		const now = Date.now();
		const endThreshold = now - 60 * 60 * 1000; // show events ending within the last hour

		const upcoming = events.filter((event) => {
			if (!event.is_active) return false;
			const endsAt = event.end_time ? new Date(event.end_time).getTime() : new Date(event.start_time).getTime();
			return endsAt >= endThreshold;
		});

		return upcoming
			.map((event) => {
				const distanceKm = coords
					? getDistanceKm(coords.latitude, coords.longitude, event.location_lat, event.location_lng)
					: null;
				return { ...event, distanceKm };
			})
			.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
	}, [events, coords]);

	const renderDistance = (distanceKm: number | null) => {
		if (distanceKm == null) return null;
		return (
			<Chip
				size="small"
				color="primary"
				variant="outlined"
				icon={<PlaceIcon fontSize="small" />}
				label={formatDistance(distanceKm, distanceUnit)}
			/>
		);
	};

	if (!events.length) {
		return <Alert severity="info">No events have been posted yet. Be the first to host one!</Alert>;
	}

	if (locationLoading && !coords) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
				<Stack spacing={2} alignItems="center">
					<EventAvailableIcon color="primary" fontSize="large" />
					<Typography>Finding parties near you...</Typography>
				</Stack>
			</Box>
		);
	}

	const listContent = (
		<Stack spacing={2}>
			{decoratedEvents.map((event) => {
				const isFavorite = favoriteIds.has(event.id);
				const startAt = new Date(event.start_time);
				const endAt = event.end_time ? new Date(event.end_time) : null;
				const eventTags = event.tags ?? [];

				return (
					<Card key={event.id} variant="outlined">
						<CardContent>
							<Stack spacing={1.5}>
								<Stack direction="row" spacing={1} alignItems="center">
									<Typography variant="h6" sx={{ fontWeight: 600 }}>
										{event.title}
									</Typography>
									{renderDistance(event.distanceKm)}
								</Stack>

								<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
									<Chip size="small" icon={<CelebrationIcon fontSize="small" />} label={HOST_LABELS[event.host_type]} />
									<Chip
										size="small"
										icon={<ScheduleIcon fontSize="small" />}
										label={startAt.toLocaleString([], {
											month: 'short',
											day: 'numeric',
											hour: 'numeric',
											minute: '2-digit'
										})}
									/>
									{endAt && (
										<Chip
											size="small"
											variant="outlined"
											icon={<ScheduleIcon fontSize="small" />}
											label={`Ends ${endAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
										/>
									)}
									{event.theme && (
										<Chip size="small" variant="outlined" icon={<CelebrationIcon fontSize="small" />} label={`Theme: ${event.theme}`} />
									)}
									{event.music_type && (
										<Chip size="small" variant="outlined" icon={<MusicNoteIcon fontSize="small" />} label={event.music_type} />
									)}
									{event.cover_charge && (
										<Chip size="small" variant="outlined" icon={<LocalBarIcon fontSize="small" />} label={event.cover_charge} />
									)}
									{event.is_byob && <Chip size="small" color="secondary" variant="outlined" label="BYOB" />}
								</Stack>

								{event.description && (
									<Typography variant="body2" color="text.secondary">
										{expandedId === event.id
											? event.description
											: `${event.description.slice(0, 140)}${event.description.length > 140 ? '…' : ''}`}
									</Typography>
								)}

								{eventTags.length > 0 && (
									<Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
										{eventTags.map((tag) => (
											<Chip key={tag} size="small" variant="outlined" label={tag} />
										))}
									</Stack>
								)}
							</Stack>
						</CardContent>
						<Divider />
						<CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1.5 }}>
							{event.description && event.description.length > 140 && (
								<Button size="small" onClick={() => setExpandedId((prev) => (prev === event.id ? null : event.id))}>
									{expandedId === event.id ? 'Show less' : 'Read more'}
								</Button>
							)}

							<Stack direction="row" spacing={1} alignItems="center">
								{onCheckIn && (
									<Button
										size="small"
										variant="outlined"
										color="primary"
										startIcon={<CheckCircleIcon />}
										onClick={() => onCheckIn(event.id)}
										disabled={pendingCheckInId === event.id}
									>
										{pendingCheckInId === event.id ? 'Checking in...' : 'Check in'}
									</Button>
								)}
								<Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
									<span>
										<IconButton
											color={isFavorite ? 'secondary' : 'default'}
											onClick={() => onToggleFavorite(event.id)}
											disabled={pendingFavoriteId === event.id}
										>
											{isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
										</IconButton>
									</span>
								</Tooltip>
							</Stack>
						</CardActions>
					</Card>
				);
			})}
		</Stack>
	);

	if (locationError && !coords) {
		return (
			<Alert
				severity="warning"
				action={
					<Button color="inherit" size="small" onClick={() => refetch()}>
						Retry
					</Button>
				}
			>
				We could not access your location. Enable location services to see distances to each party.
			</Alert>
		);
	}

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
			<Box>
				<Typography variant="h5" sx={{ fontWeight: 600 }}>
					Upcoming Parties
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Curated list of events happening soon. Tap a card to explore the vibe.
				</Typography>
			</Box>

			{decoratedEvents.length === 0 ? <Alert severity="info">No upcoming events match your filters right now.</Alert> : listContent}
		</Box>
	);
};

export default NearbyLocations;

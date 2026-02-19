import { Viewer3D } from '../components/Viewer3D';
import { Controls } from '../components/Controls';
import { Box } from 'lucide-react';

export const MainLayout = () => {
    return (
        <div className="flex h-full bg-dark text-white overflow-hidden">
            {/* 3D Viewer Area */}
            <div className="flex-1 relative">
                <Viewer3D />
                <NoImageOverlay />
            </div>

            {/* Sidebar Controls — scrollable */}
            <Controls />
        </div>
    );
};

import { useAppStore } from '../store/AppContext';

const NoImageOverlay = () => {
    const { originalImage } = useAppStore();

    if (originalImage) return null;

    return (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex items-center justify-center z-10">
            <div className="bg-black/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700 text-center">
                <p className="text-xl font-semibold text-gray-200">Start by uploading an image</p>
                <p className="text-sm text-gray-400">Use the panel on the right ➔</p>
            </div>
        </div>
    );
};

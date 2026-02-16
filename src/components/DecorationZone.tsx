import React, { useRef } from 'react';

interface DecorationZoneProps {
    images: (string | null)[];
    onImageUpload: (index: number, dataUrl: string) => void;
    onImageRemove: (index: number) => void;
    editMode: boolean;
    position: 'top' | 'left' | 'right' | 'bottom';
}

export const DecorationZone: React.FC<DecorationZoneProps> = ({
    images,
    position,
}) => {
    const isHorizontal = position === 'top' || position === 'bottom';
    const hasAny = images.some((img) => img !== null);

    if (!hasAny) return null;

    return (
        <div className={`deco-zone deco-zone-${position} ${isHorizontal ? 'deco-horizontal' : 'deco-vertical'} print-only`}>
            {images.map((img, i) => (
                img && (
                    <div key={i} className="deco-slot">
                        <div className="deco-slot-filled">
                            <img src={img} alt={`decoration ${i + 1}`} className="deco-image" />
                        </div>
                    </div>
                )
            ))}
        </div>
    );
};

/* ---- Decoration Manager (visible on-screen for uploading) ---- */

interface DecoManagerProps {
    label: string;
    images: (string | null)[];
    onUpload: (index: number, dataUrl: string) => void;
    onRemove: (index: number) => void;
}

export const DecoManager: React.FC<DecoManagerProps> = ({
    label,
    images,
    onUpload,
    onRemove,
}) => {
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onUpload(index, reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="deco-manager-row">
            <span className="deco-manager-label">{label}</span>
            <div className="deco-manager-slots">
                {images.map((img, i) => (
                    <div key={i} className="deco-manager-slot">
                        {img ? (
                            <div className="deco-manager-filled">
                                <img src={img} alt="" className="deco-manager-thumb" />
                                <button
                                    className="deco-manager-remove"
                                    onClick={() => onRemove(i)}
                                    title="Remove"
                                >✕</button>
                            </div>
                        ) : (
                            <button
                                className="deco-manager-add"
                                onClick={() => fileInputRefs.current[i]?.click()}
                                title="Upload drawing"
                            >+</button>
                        )}
                        <input
                            type="file"
                            ref={(el) => { fileInputRefs.current[i] = el; }}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleFileChange(i, e)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

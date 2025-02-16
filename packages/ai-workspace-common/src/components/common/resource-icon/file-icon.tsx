import React from 'react';
import PropTypes from 'prop-types';
import { colord, extend as extendColord } from 'colord';
import namesPlugin from 'colord/plugins/names';

import glyphs from './glyphs';

extendColord([namesPlugin]);

const propTypes = {
  /** Color of icon background */
  color: PropTypes.string,
  /** Text to display in label */
  extension: PropTypes.string,
  /** Displays the corner fold */
  fold: PropTypes.bool,
  /** Color of the corner fold */
  foldColor: PropTypes.string,
  /** Color of file type icon */
  glyphColor: PropTypes.string,
  /** Color of page gradient */
  gradientColor: PropTypes.string,
  /** Opacity of page gradient */
  gradientOpacity: PropTypes.number,
  /** Color of label */
  labelColor: PropTypes.string,
  /** Color of label text */
  labelTextColor: PropTypes.string,
  /** Displays the label in all caps */
  labelUppercase: PropTypes.bool,
  /** Corner radius of the file icon */
  radius: PropTypes.number,
  /** Type of glyph icon to display */
  type: PropTypes.oneOf([
    '3d',
    'acrobat',
    'android',
    'audio',
    'binary',
    'code',
    'code2',
    'compressed',
    'document',
    'drive',
    'font',
    'image',
    'presentation',
    'settings',
    'spreadsheet',
    'vector',
    'video',
  ]),
  /** Width of the icon */
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /** Height of the icon */
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

const VIEWBOX = {
  WIDTH: 40,
  HEIGHT: 48,
};

const ICON = {
  WIDTH: VIEWBOX.WIDTH,
  HEIGHT: VIEWBOX.HEIGHT,
  X_OFFSET: 0,
};

const FOLD = {
  HEIGHT: 12,
};

const LABEL_HEIGHT = 14;

const useId =
  React.useId ||
  (() => {
    let i = 0;
    return () => i++;
  })();

export const FileIcon = ({
  color = 'whitesmoke',
  extension,
  fold = true,
  foldColor,
  glyphColor,
  gradientColor = 'white',
  gradientOpacity = 0.25,
  labelColor,
  labelTextColor = 'white',
  labelUppercase = false,
  radius = 4,
  type,
  width = '100%',
  height = 30,
}) => {
  const id = useId();
  const UNIQUE_ID = id;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEWBOX.WIDTH} ${VIEWBOX.HEIGHT}`}
      width={width}
      height={height}
      style={{ maxWidth: '100%' }}
    >
      <defs>
        <clipPath id={`pageRadius${UNIQUE_ID}`}>
          <rect
            x={ICON.X_OFFSET}
            y="0"
            rx={radius}
            ry={radius}
            width={ICON.WIDTH}
            height={ICON.HEIGHT}
          />
        </clipPath>

        <clipPath id={`foldCrop${UNIQUE_ID}`}>
          <rect
            width={ICON.WIDTH}
            height={FOLD.HEIGHT}
            transform={`rotate(-45 0 ${FOLD.HEIGHT})`}
          />
        </clipPath>
        <linearGradient x1="100%" y1="0%" y2="100%" id={`pageGradient${UNIQUE_ID}`}>
          <stop stopColor={gradientColor} stopOpacity={gradientOpacity} offset="0%" />
          <stop stopColor={gradientColor} stopOpacity="0" offset="66.67%" />
        </linearGradient>
      </defs>

      <g id="file" clipPath={`url(#pageRadius${UNIQUE_ID})`}>
        {fold ? (
          <React.Fragment>
            <path
              d={`M${ICON.X_OFFSET} 0 h ${ICON.WIDTH - FOLD.HEIGHT} L ${
                ICON.WIDTH + ICON.X_OFFSET
              } ${FOLD.HEIGHT} v ${ICON.HEIGHT - FOLD.HEIGHT} H ${ICON.X_OFFSET} Z`}
              fill={color}
            />
            <path
              d={`M${ICON.X_OFFSET} 0 h ${ICON.WIDTH - FOLD.HEIGHT} L ${
                ICON.WIDTH + ICON.X_OFFSET
              } ${FOLD.HEIGHT} v ${ICON.HEIGHT - FOLD.HEIGHT} H ${ICON.X_OFFSET} Z`}
              fill={`url(#pageGradient${UNIQUE_ID})`}
            />
          </React.Fragment>
        ) : (
          <React.Fragment>
            <rect x={ICON.X_OFFSET} y="0" width={ICON.WIDTH} height={ICON.HEIGHT} fill={color} />
            <rect
              x={ICON.X_OFFSET}
              y="0"
              width={ICON.WIDTH}
              height={ICON.HEIGHT}
              fill={`url(#pageGradient${UNIQUE_ID})`}
            />
          </React.Fragment>
        )}
      </g>

      {fold && (
        <g transform={`translate(28 ${FOLD.HEIGHT}) rotate(-90)`}>
          <rect
            width={ICON.WIDTH}
            height={ICON.HEIGHT}
            fill={foldColor || colord(color).darken(0.1).toHex()}
            rx={radius}
            ry={radius}
            clipPath={`url(#foldCrop${UNIQUE_ID})`}
          />
        </g>
      )}

      {extension && (
        <React.Fragment>
          <g id={`label${UNIQUE_ID}`}>
            <rect
              fill={labelColor || colord(color).darken(0.3).toHex()}
              x={ICON.X_OFFSET}
              y={ICON.HEIGHT - LABEL_HEIGHT}
              width={ICON.WIDTH}
              height={LABEL_HEIGHT}
              clipPath={`url(#pageRadius${UNIQUE_ID})`}
            />
          </g>
          <g id={`labelText${UNIQUE_ID}`} transform={`translate(${ICON.X_OFFSET} 34)`}>
            <text
              x={ICON.WIDTH / 2}
              y="10"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
              fontSize="9"
              fill={labelTextColor}
              textAnchor="middle"
              style={{
                fontWeight: 'bold',
                textAlign: 'center',
                pointerEvents: 'none',
                textTransform: labelUppercase ? 'uppercase' : 'none',
                userSelect: 'none',
              }}
            >
              {extension}
            </text>
          </g>
        </React.Fragment>
      )}

      {type && (
        <g
          transform={`translate(-4 ${!extension ? 6 : 0})`}
          fill={glyphColor || colord(color).darken(0.15).toHex()}
        >
          {glyphs[type]}
        </g>
      )}
    </svg>
  );
};

FileIcon.propTypes = propTypes;
export default FileIcon;

import { useId } from 'react'

interface SliderInputProps {
  value: number
  min: number
  max: number
  step?: number
  label?: string
  minLabel?: string
  maxLabel?: string
  showValue?: boolean
  valueFormatter?: (value: number) => string
  onChange: (value: number) => void
  className?: string
}

export function SliderInput({
  value,
  min,
  max,
  step = 1,
  label,
  minLabel,
  maxLabel,
  showValue = true,
  valueFormatter,
  onChange,
  className = '',
}: SliderInputProps) {
  const sliderId = useId()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }

  const percentage = ((value - min) / (max - min)) * 100
  const displayValue = valueFormatter ? valueFormatter(value) : value.toString()

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label
            htmlFor={sliderId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
          {showValue && (
            <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
              {displayValue}
            </span>
          )}
        </div>
      )}

      <div className="relative">
        <input
          id={sliderId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="slider-input w-full"
          style={{
            background: `linear-gradient(to right, rgb(37 99 235) 0%, rgb(37 99 235) ${percentage}%, rgb(229 231 235) ${percentage}%, rgb(229 231 235) 100%)`,
          }}
        />
      </div>

      {(minLabel || maxLabel) && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {minLabel || min}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {maxLabel || max}
          </span>
        </div>
      )}

      <style>{`
        .slider-input {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 9999px;
          outline: none;
          transition: opacity 0.2s;
        }

        .slider-input:hover {
          opacity: 0.9;
        }

        .slider-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Webkit browsers (Chrome, Safari) */
        .slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgb(37 99 235);
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .slider-input::-webkit-slider-thumb:hover {
          width: 20px;
          height: 20px;
          background: rgb(29 78 216);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider-input::-webkit-slider-thumb:active {
          width: 22px;
          height: 22px;
          background: rgb(30 64 175);
        }

        /* Firefox */
        .slider-input::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border: none;
          border-radius: 50%;
          background: rgb(37 99 235);
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .slider-input::-moz-range-thumb:hover {
          width: 20px;
          height: 20px;
          background: rgb(29 78 216);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider-input::-moz-range-thumb:active {
          width: 22px;
          height: 22px;
          background: rgb(30 64 175);
        }

        .slider-input::-moz-range-track {
          background: transparent;
          border: none;
        }

        /* Dark mode adjustments */
        @media (prefers-color-scheme: dark) {
          .slider-input {
            background: linear-gradient(to right, rgb(37 99 235) 0%, rgb(37 99 235) var(--percentage), rgb(55 65 81) var(--percentage), rgb(55 65 81) 100%) !important;
          }

          .slider-input::-webkit-slider-thumb {
            background: rgb(59 130 246);
          }

          .slider-input::-webkit-slider-thumb:hover {
            background: rgb(37 99 235);
          }

          .slider-input::-webkit-slider-thumb:active {
            background: rgb(29 78 216);
          }

          .slider-input::-moz-range-thumb {
            background: rgb(59 130 246);
          }

          .slider-input::-moz-range-thumb:hover {
            background: rgb(37 99 235);
          }

          .slider-input::-moz-range-thumb:active {
            background: rgb(29 78 216);
          }
        }
      `}</style>
    </div>
  )
}

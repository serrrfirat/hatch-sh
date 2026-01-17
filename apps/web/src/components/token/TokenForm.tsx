import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTokenStore } from '../../stores/tokenStore'
import { Input } from '@hatch/ui'

export function TokenForm() {
  const { formData, setFormData, launchError } = useTokenStore()
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData({ imageFile: file })
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Token Name */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Token Name
        </label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ name: e.target.value })}
          placeholder="My Awesome App"
          maxLength={50}
        />
      </div>

      {/* Token Symbol */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Ticker
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-green">
            $
          </span>
          <Input
            value={formData.symbol}
            onChange={(e) => setFormData({ symbol: e.target.value.toUpperCase() })}
            placeholder="AWESOME"
            maxLength={10}
            className="pl-7 uppercase"
          />
        </div>
      </div>

      {/* Token Image */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Image
        </label>
        <div className="flex items-center gap-3">
          {/* Preview */}
          <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-bg-tertiary">
            {imagePreview ? (
              <img src={imagePreview} alt="Token" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🚀</span>
            )}
          </div>

          {/* Upload button */}
          <label className="flex-1 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <span className="block w-full px-3 py-2 text-sm text-center bg-bg-tertiary border border-border rounded-lg hover:bg-bg-secondary transition">
              Upload Image
            </span>
          </label>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Square image, 500x500px recommended
        </p>
      </div>

      {/* Error message */}
      {launchError && (
        <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/20">
          <p className="text-sm text-accent-red">{launchError}</p>
        </div>
      )}

      {/* Info */}
      <div className="p-3 rounded-lg bg-bg-tertiary">
        <p className="text-xs text-gray-500">
          Your token will launch on a bonding curve. When market cap reaches $69k,
          liquidity graduates to Uniswap.
        </p>
      </div>
    </motion.div>
  )
}

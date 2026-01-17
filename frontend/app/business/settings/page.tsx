"use client"

import type React from "react"

import { useState } from "react"
import { Save, Camera, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function BusinessSettings() {
  const [activeTab, setActiveTab] = useState("profile")
  const [formData, setFormData] = useState({
    businessName: "Your Business Name",
    businessBio: "Crafting excellence in every product",
    website: "https://yourbusiness.com",
    email: "business@yourbusiness.com",
    phone: "+91 98765 43210",
    instagram: "@yourbusiness",
    twitter: "@yourbusiness",
    businessVerified: true,
    primaryColor: "#7C3AED",
    secondaryColor: "#EC4899",
    contactButton: "message",
  })
  const [showSaveNotif, setShowSaveNotif] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = () => {
    setShowSaveNotif(true)
    setTimeout(() => setShowSaveNotif(false), 3000)
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start md:items-center gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Business Settings</h1>
          <p className="text-muted-foreground">Customize your business profile and preferences</p>
        </div>
        {showSaveNotif && (
          <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold">
            <CheckCircle size={16} />
            Settings saved successfully
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {["profile", "branding", "contact", "integrations", "privacy"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 font-semibold transition capitalize border-b-2 whitespace-nowrap ${
              activeTab === tab
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {/* Profile Picture */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="font-bold text-foreground text-lg mb-6">Profile Picture</h3>
            <div className="flex gap-6 items-start">
              <div className="relative">
                <img src="/business-avatar.jpg" alt="Business" className="w-24 h-24 rounded-full object-cover" />
                <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white hover:bg-primary/90">
                  <Camera size={16} />
                </button>
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-4">
                  Recommended size: 400x400px. Max file size: 10MB. JPG, PNG, or WEBP.
                </p>
              </div>
            </div>
          </div>

          {/* Profile Info */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Business Name</label>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Bio</label>
              <textarea
                name="businessBio"
                value={formData.businessBio}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-2">160 characters max</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Verification */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              <div className="text-sm text-green-900">
                <p className="font-semibold mb-1">Business Verified</p>
                <p>Your business account has been verified by ClickME.</p>
              </div>
            </div>

            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 gap-2 w-full md:w-auto">
              <Save size={18} />
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Branding Tab */}
      {activeTab === "branding" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <h3 className="font-bold text-foreground text-lg">Brand Colors</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Primary Color", name: "primaryColor" },
                { label: "Secondary Color", name: "secondaryColor" },
              ].map((item) => (
                <div key={item.name}>
                  <label className="block text-sm font-semibold text-foreground mb-2">{item.label}</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      name={item.name}
                      value={formData[item.name as keyof typeof formData]}
                      onChange={handleColorChange}
                      className="w-16 h-10 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      name={item.name}
                      value={formData[item.name as keyof typeof formData]}
                      onChange={handleColorChange}
                      className="flex-1 px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <h3 className="font-bold text-foreground text-lg pt-4">Contact Button</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="contactButton"
                  value="message"
                  checked={formData.contactButton === "message"}
                  onChange={handleRadioChange}
                  id="message"
                />
                <label htmlFor="message" className="flex-1">
                  <p className="font-semibold text-foreground">Message</p>
                  <p className="text-xs text-muted-foreground">Show message button on profile</p>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="contactButton"
                  value="call"
                  checked={formData.contactButton === "call"}
                  onChange={handleRadioChange}
                  id="call"
                />
                <label htmlFor="call" className="flex-1">
                  <p className="font-semibold text-foreground">Call</p>
                  <p className="text-xs text-muted-foreground">Show call button on profile</p>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="contactButton"
                  value="both"
                  checked={formData.contactButton === "both"}
                  onChange={handleRadioChange}
                  id="both"
                />
                <label htmlFor="both" className="flex-1">
                  <p className="font-semibold text-foreground">Both</p>
                  <p className="text-xs text-muted-foreground">Show both message and call buttons</p>
                </label>
              </div>
            </div>

            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 gap-2 w-full md:w-auto">
              <Save size={18} />
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Contact Tab */}
      {activeTab === "contact" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <h3 className="font-bold text-foreground text-lg">Contact Information</h3>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <h3 className="font-bold text-foreground text-lg pt-4">Social Media</h3>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Instagram</label>
              <input
                type="text"
                name="instagram"
                value={formData.instagram}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Twitter</label>
              <input
                type="text"
                name="twitter"
                value={formData.twitter}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 gap-2 w-full md:w-auto">
              <Save size={18} />
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: "Stripe", status: "connected", icon: "💳" },
              { name: "Mailchimp", status: "not-connected", icon: "📧" },
              { name: "Google Analytics", status: "connected", icon: "📊" },
              { name: "Facebook Pixel", status: "not-connected", icon: "👁️" },
            ].map((integration) => (
              <div key={integration.name} className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-2xl mb-2">{integration.icon}</p>
                    <h4 className="font-bold text-foreground">{integration.name}</h4>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      integration.status === "connected" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {integration.status === "connected" ? "Connected" : "Not Connected"}
                  </span>
                </div>
                <Button variant="outline" className="w-full text-sm bg-transparent">
                  {integration.status === "connected" ? "Disconnect" : "Connect"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === "privacy" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <h3 className="font-bold text-foreground text-lg">Privacy & Security</h3>

            {[
              { label: "Allow customers to see your profile", checked: true },
              { label: "Show online status to customers", checked: true },
              { label: "Allow reviews and ratings", checked: true },
              { label: "Newsletter opt-in by default", checked: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <input type="checkbox" id={item.label} defaultChecked={item.checked} />
                <label htmlFor={item.label} className="text-foreground font-semibold cursor-pointer">
                  {item.label}
                </label>
              </div>
            ))}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3 mt-6">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0" />
              <div className="text-sm text-yellow-900">
                <p className="font-semibold mb-1">Danger Zone</p>
                <p className="mb-3">These actions cannot be undone.</p>
                <Button variant="outline" className="bg-red-100 text-red-700 border-red-300 hover:bg-red-200">
                  Deactivate Business Account
                </Button>
              </div>
            </div>

            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 gap-2 w-full md:w-auto">
              <Save size={18} />
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

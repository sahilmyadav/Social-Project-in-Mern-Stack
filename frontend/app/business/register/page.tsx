"use client"

import React, { useState } from "react"
import { ArrowRight, Upload, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function BusinessRegister() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    email: "",
    phone: "",
    website: "",
    businessAddress: "",
    city: "",
    state: "",
    pincode: "",
    gstNumber: "",
    panNumber: "",
    bankAccountNumber: "",
    ifscCode: "",
    accountHolderName: "",
  })
  const [documents, setDocuments] = useState({
    businessLicense: null,
    panCard: null,
    bankStatement: null,
    ownerIdProof: null,
  })
  const [submitted, setSubmitted] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0]
    if (file) {
      setDocuments((prev) => ({ ...prev, [docType]: file.name }))
    }
  }

  const handleSubmit = () => {
    setSubmitted(true)
    setTimeout(() => {
      // Navigate to dashboard after submission
      window.location.href = "/business/dashboard"
    }, 2000)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-foreground">Application Submitted</h1>
          <p className="text-muted-foreground mb-6">
            Your business registration has been submitted for verification. We'll review your documents and contact you
            within 48 hours.
          </p>
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/home" className="text-primary hover:underline flex items-center gap-2 text-sm mb-4">
            ← Back to ClickME
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Register Your Business</h1>
          <p className="text-muted-foreground">Join our Business Suite and start monetizing your content</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition ${
                  s <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 4 && <div className={`flex-1 h-1 mx-2 transition ${s < step ? "bg-primary" : "bg-muted"}`}></div>}
            </React.Fragment>
          ))}
        </div>

        {/* Forms */}
        <div className="bg-card border border-border rounded-2xl p-8 mb-8">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Business Name</label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  placeholder="Your business name"
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Business Type</label>
                <select
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select type</option>
                  <option value="sole">Sole Proprietorship</option>
                  <option value="partnership">Partnership</option>
                  <option value="llp">LLP</option>
                  <option value="pvt">Private Limited</option>
                  <option value="individual">Individual Creator</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="business@example.com"
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
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Website (Optional)</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Step 2: Address */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Business Address</label>
                <input
                  type="text"
                  name="businessAddress"
                  value={formData.businessAddress}
                  onChange={handleInputChange}
                  placeholder="Street address"
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="City"
                    className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="State"
                    className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    placeholder="123456"
                    className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">GST Number</label>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleInputChange}
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">PAN Number</label>
                  <input
                    type="text"
                    name="panNumber"
                    value={formData.panNumber}
                    onChange={handleInputChange}
                    placeholder="ABCDE1234F"
                    className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Bank Details */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Account Holder Name</label>
                <input
                  type="text"
                  name="accountHolderName"
                  value={formData.accountHolderName}
                  onChange={handleInputChange}
                  placeholder="Name as per bank account"
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Bank Account Number</label>
                <input
                  type="text"
                  name="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={handleInputChange}
                  placeholder="1234 5678 9012 3456"
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">IFSC Code</label>
                <input
                  type="text"
                  name="ifscCode"
                  value={formData.ifscCode}
                  onChange={handleInputChange}
                  placeholder="SBIN0001234"
                  className="w-full px-4 py-3 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <AlertCircle size={20} className="text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  Bank details are encrypted and only used for withdrawals. We never store card details.
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Documents */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-4">
                {[
                  { key: "businessLicense", label: "Business License / Registration" },
                  { key: "panCard", label: "PAN Card" },
                  { key: "bankStatement", label: "Recent Bank Statement" },
                  { key: "ownerIdProof", label: "Owner ID Proof" },
                ].map((doc) => (
                  <div key={doc.key}>
                    <label className="block text-sm font-semibold text-foreground mb-2">{doc.label}</label>
                    <div className="border-2 border-dashed border-primary rounded-lg p-6 text-center cursor-pointer hover:bg-muted transition">
                      <input
                        type="file"
                        onChange={(e) => handleFileChange(e, doc.key)}
                        className="hidden"
                        id={doc.key}
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <label htmlFor={doc.key} className="cursor-pointer block">
                        <Upload size={24} className="text-primary mx-auto mb-2" />
                        <p className="text-sm font-semibold text-foreground">
                          {documents[doc.key as keyof typeof documents] || "Click to upload"}
                        </p>
                        <p className="text-xs text-muted-foreground">PDF, JPG, or PNG</p>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                <div className="text-sm text-green-900">
                  All documents are verified by our compliance team. Processing takes 24-48 hours.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-4">
          <Button
            onClick={() => setStep(Math.max(1, step - 1))}
            variant="outline"
            disabled={step === 1}
            className="flex-1"
          >
            Previous
          </Button>
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              Next <ArrowRight size={18} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2">
              Submit Registration <CheckCircle size={18} />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

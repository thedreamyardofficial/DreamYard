import mongoose from "mongoose";

// One document that holds the editable site-wide content
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "site", unique: true },
    storeName: { type: String, default: "DreamYard" },
    announcement: { type: String, default: "Free delivery across India on orders above ₹2,000" },
    heroTitle: { type: String, default: "Cloth that remembers the loom." },
    heroSubtitle: {
      type: String,
      default: "Handloom cotton, linen and khadi, cut into clothes you'll wear for years.",
    },
    footerNote: { type: String, default: "Easy 7-day returns on unworn pieces." },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    termsContent: {
      type: String,
      maxlength: 20000,
      default: [
        "## Eligibility",
        "You must be at least 18 years old to place an order.",
        "## Pricing and product details",
        "We make reasonable efforts to display accurate prices and product information. We reserve the right to correct errors or update product details. If a correction affects an order, we will contact you about the available options.",
        "## Accounts and misuse",
        "Please provide accurate account and order information. We may suspend or terminate access where we reasonably believe an account is involved in fraud, abuse, or unlawful activity.",
        "## Intellectual property",
        "The text, photographs, logos, and designs on this website belong to DreamYard or its licensors. You may not copy or use them without permission.",
        "## Governing law",
        "These terms are subject to the jurisdiction of courts in [CITY, STATE], India. Replace this placeholder with your business jurisdiction before publishing.",
      ].join("\n\n"),
    },
    privacyContent: {
      type: String,
      maxlength: 20000,
      default: [
        "## Information collected",
        "We may collect your name, email address, phone number, delivery address, account details, order details, and technical information such as IP address and browser data recorded in service logs.",
        "## How information is used",
        "We use information to manage accounts, process orders and payments, deliver purchases, provide shipment tracking, prevent misuse, and respond to support requests. Marketing messages are sent only if you opt in.",
        "## Sharing and service providers",
        "We share relevant delivery details with courier partners and payment details with our payment provider when needed to complete an order. Service providers may process information to host, secure, and operate this website.",
        "## Cookies and browser storage",
        "Cookies and browser storage may be used for site functions and to retain items in your shopping bag or remember preferences. You can manage cookies in your browser settings; disabling them may affect some features.",
        "## Retention, security, and your choices",
        "We retain account and order records as needed for fulfillment, legal obligations, and support. We use reasonable safeguards, but no online storage or transmission method is completely secure. Contact us to ask about accessing or correcting your information.",
        "## Contact",
        "Use the contact details on our Contact and Grievance page for privacy questions.",
      ].join("\n\n"),
    },
    shippingReturnsContent: {
      type: String,
      maxlength: 20000,
      default: [
        "## Dispatch and delivery",
        "Dispatch estimate: [ADD DISPATCH TIME]. Estimated delivery: [ADD DELIVERY WINDOW]. Delivery estimates may vary by destination, courier, and circumstances outside our control.",
        "## Returns and exchanges",
        "Contact us within [ADD RETURN WINDOW] of delivery to request a return or exchange. Items must be unworn, unwashed, and have their original tags intact. Add any product exclusions and return instructions here.",
        "## Refunds",
        "Approved refunds are issued by [ADD REFUND METHOD] after the returned item is received and inspected. Add the expected processing time here.",
        "## Return shipping",
        "[STATE WHO PAYS REVERSE SHIPPING CHARGES AND ANY CONDITIONS].",
        "## Support",
        "For help with an order, use the contact details on our Contact and Grievance page.",
        "Replace every bracketed placeholder with your actual policy before publishing.",
      ].join("\n\n"),
    },
    contactGrievanceContent: {
      type: String,
      maxlength: 20000,
      default: [
        "## Customer support",
        "Email: [ADD CUSTOMER CARE EMAIL]\nPhone: [ADD CUSTOMER CARE PHONE]\nRegistered business address: [ADD REGISTERED ADDRESS]",
        "## Grievance officer",
        "Name: [ADD GRIEVANCE OFFICER NAME]\nEmail: [ADD GRIEVANCE OFFICER EMAIL]\nComplaints will be acknowledged within 48 hours and addressed within one month of receipt.",
        "Replace every bracketed placeholder with accurate business details before publishing.",
      ].join("\n\n"),
    },
  },
  { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);

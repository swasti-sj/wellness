import React, { useState } from "react";
import "../../styles/EmergencyContacts.css";

const contacts = [
  {
    name: "Wellness Centre",
    detail: "Mobile · 24×7",
    description: "24×7 Wellness Centre contact",
    number: "8147 403386",
    phoneNumber: "8147403386",
    theme: "wellness",
  },
  {
    name: "Wellness Centre",
    detail: "Landline",
    description: "Wellness Centre landline",
    number: "0836 230 9644",
    phoneNumber: "08362309644",
    theme: "landline",
  },
  {
    name: "Ambulance",
    detail: "Official Wellness listing",
    description: "For ambulance assistance",
    number: "89715 23447",
    phoneNumber: "8971523447",
    theme: "ambulance",
  },
];

export default function EmergencyContacts() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`emergency-panel${isCollapsed ? " emergency-panel-collapsed" : ""}`}>
      {isCollapsed ? (
        <button
          className="emergency-panel-reopen"
          type="button"
          onClick={() => setIsCollapsed(false)}
          aria-label="Open emergency contacts"
          aria-expanded="false"
        >
          <span aria-hidden="true">☎</span>
          <span>Emergency</span>
        </button>
      ) : (
        <>
          <div className="emergency-panel-header">
            <span className="emergency-panel-icon" aria-hidden="true">!</span>
            <div>
              <p>Keep these numbers handy</p>
              <h2 id="emergency-panel-title">Emergency Contacts</h2>
            </div>
            <button
              className="emergency-panel-close"
              type="button"
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse emergency contacts to the side"
              title="Move to side"
              aria-expanded="true"
            >
              ×
            </button>
          </div>
          <div className="emergency-panel-list">
            {contacts.map((contact) => (
              <article
                className={`emergency-panel-contact emergency-panel-contact-${contact.theme}`}
                key={contact.theme}
              >
                <div>
                  <h3>{contact.name}</h3>
                  <p className="emergency-panel-detail">{contact.detail}</p>
                  <p className="emergency-panel-description">{contact.description}</p>
                </div>
                <a href={`tel:${contact.phoneNumber}`} aria-label={`Call ${contact.name}: ${contact.number}`}>
                  <span aria-hidden="true">☎</span>
                  {contact.number}
                </a>
              </article>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

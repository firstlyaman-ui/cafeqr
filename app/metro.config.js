const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const role = String(process.env.EXPO_PUBLIC_APP_ROLE || "customer").toLowerCase();

/** Exclude other-role route files so they are never registered in this build. */
const appDir = path.resolve(__dirname, "app");
const blockPatterns = [];

if (role === "customer") {
  blockPatterns.push(
    new RegExp(`${escapeRe(appDir)}[/\\\\]owner([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]staff([/\\\\]|$)`),
  );
} else if (role === "staff") {
  blockPatterns.push(
    new RegExp(`${escapeRe(appDir)}[/\\\\]owner([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]c([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]t([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]order([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]confirmation([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]cart\\.tsx$`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]checkout\\.tsx$`),
  );
} else if (role === "owner") {
  blockPatterns.push(
    new RegExp(`${escapeRe(appDir)}[/\\\\]staff([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]c([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]t([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]order([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]confirmation([/\\\\]|$)`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]cart\\.tsx$`),
    new RegExp(`${escapeRe(appDir)}[/\\\\]checkout\\.tsx$`),
  );
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const prev = config.resolver.blockList;
const prevList = Array.isArray(prev) ? prev : prev ? [prev] : [];
config.resolver.blockList = [...prevList, ...blockPatterns];

module.exports = config;

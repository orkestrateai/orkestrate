'use client';

export function JsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Orkestrate',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description: 'Multi-agent AI orchestration platform for coordinating multiple AI coding agents on a single codebase with zero conflicts.',
    url: 'https://orkestrate.space',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '0',
      highPrice: '99',
      offerCount: '3',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '127',
    },
    featureList: [
      'Multi-Agent Orchestration',
      'Intelligent Task Routing',
      'Conflict Prevention',
      'Unified Logging',
      'Enterprise Security',
      'MCP Integration',
    ],
    softwareVersion: '1.0',
    applicationSubCategory: 'AI Development Tools',
    keywords: 'multi-agent AI, code orchestration, Claude Code, MCP protocol, AI development',
    provider: {
      '@type': 'Organization',
      name: 'Orkestrate',
      url: 'https://orkestrate.space',
    },
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Orkestrate',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, macOS, Linux',
    description: 'The ultimate coordination layer for AI coding tools. Connect Claude Code, OpenCode, Codex, and any MCP-compatible client to a shared workspace.',
    url: 'https://orkestrate.space',
    image: 'https://orkestrate.space/icon.svg',
    author: {
      '@type': 'Organization',
      name: 'Orkestrate',
      url: 'https://orkestrate.space',
    },
    programmingLanguage: ['TypeScript', 'Python', 'JavaScript'],
    applicationSuite: 'Orkestrate',
    toolCategory: ['AI Development Tools', 'Code Collaboration', 'Developer Productivity'],
  };

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to set up multi-agent AI orchestration with Orkestrate',
    description: 'A step-by-step guide to connecting multiple AI coding agents to Orkestrate for coordinated development.',
    totalTime: 'PT5M',
    step: [
      {
        '@type': 'HowToStep',
        name: 'Connect Your Agents',
        text: 'Link Claude Code, OpenCode, Codex, or any MCP-compatible client to your workspace with a single command.',
      },
      {
        '@type': 'HowToStep',
        name: 'Define Task Boundaries',
        text: 'Configure file ownership rules, define task queues, and set collaboration policies.',
      },
      {
        '@type': 'HowToStep',
        name: 'Watch Agents Collaborate',
        text: 'Agents automatically coordinate on tasks, report progress, and avoid conflicts.',
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does Orkestrate prevent agents from conflicting on the same files?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Orkestrate uses a combination of optimistic file locking and semantic task analysis. When an agent begins working on a task, Orkestrate identifies affected files and temporarily reserves them. Other agents automatically route around these files until the work is complete.',
        },
      },
      {
        '@type': 'Question',
        name: 'What AI agents are currently supported?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Orkestrate officially supports Claude Code, OpenCode, and Codex. Support for Cursor AI, Copilot Workspace, and Devin is in active development. We also support any agent that implements the Model Context Protocol (MCP).',
        },
      },
      {
        '@type': 'Question',
        name: 'Is my code secure and private?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Security is foundational to Orkestrate architecture. All data is encrypted in transit and at rest. We are SOC 2 Type II compliant. Your code never leaves your infrastructure when using self-hosted deployments.',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}

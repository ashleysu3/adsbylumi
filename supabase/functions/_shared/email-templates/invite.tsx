/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

import {
  main, container, headerBar, wordmark, card, h1, text, link, button, footer, footerBar,
} from './_styles.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerBar}>
          <Heading as="h1" style={wordmark}>Lumi ✨</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>You're invited to {siteName}</Heading>
          <Text style={text}>
            You've been invited to join{' '}
            <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
            Accept your invite below to set up your account and get started.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Accept invitation →
          </Button>
          <Text style={footer}>
            Not expecting this invite? You can safely ignore this email.
          </Text>
        </Section>
        <Section style={footerBar}>
          Lumi · Meta Ads, Simplified
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

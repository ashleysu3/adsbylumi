/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import { Img } from 'npm:@react-email/components@0.0.22'

import {
  main, container, headerBar, LOGO_URL, logoImg, card, h1, text, codeStyle, footer, footerBar,
} from './_styles.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Lumi verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerBar}>
          <Img src={LOGO_URL} alt="Lumi" style={logoImg} width="140" />
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirm it's really you</Heading>
          <Text style={text}>Use the code below to confirm your identity:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            This code expires shortly. If you didn't request this, you can safely
            ignore this email.
          </Text>
        </Section>
        <Section style={footerBar}>
          Lumi · Meta Ads, Simplified
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

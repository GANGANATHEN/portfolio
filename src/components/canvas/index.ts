'use client';
import dynamic from 'next/dynamic';

export const EarthCanvas = dynamic(() => import('./Earth'), { ssr: false });
export const BallCanvas = dynamic(() => import('./Ball'), { ssr: false });
export const ComputersCanvas = dynamic(() => import('./Computers'), { ssr: false });
export const StarsCanvas = dynamic(() => import('./Stars'), { ssr: false });
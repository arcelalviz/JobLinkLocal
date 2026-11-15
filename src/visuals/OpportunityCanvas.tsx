'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Node={point:[number,number,number];height:number;tint:string};
const nodes:Node[]=[
 {point:[-2.55,.9,-.2],height:.48,tint:'#8ec4c7'},
 {point:[-1.35,-.85,.55],height:.85,tint:'#f3b39a'},
 {point:[-.15,.72,1.2],height:1.05,tint:'#f5d4b4'},
 {point:[1.35,1.4,-.45],height:.65,tint:'#8cb1d1'},
 {point:[2.38,-.54,-.2],height:.82,tint:'#db805f'},
 {point:[.5,-1.55,.18],height:.55,tint:'#8ec4c7'}
];
const routes:[[number,number],...Array<[number,number]>]=[[0,1],[0,2],[1,2],[1,5],[2,3],[2,4],[3,4],[4,5]];

function Atlas({active}:{active:boolean}){
 const root=useRef<THREE.Group>(null);
 const curves=useMemo(()=>routes.map(([start,end])=>{
  const a=new THREE.Vector3(...nodes[start].point);
  const b=new THREE.Vector3(...nodes[end].point);
  const control=a.clone().lerp(b,.5);
  control.y+=.35;
  control.z+=.16;
  return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a,control,b),30,.023,5,false);
 }),[]);
 useEffect(()=>()=>curves.forEach(curve=>curve.dispose()),[curves]);
 useFrame(({clock,pointer},delta)=>{
  if(!active||!root.current)return;
  const time=clock.elapsedTime;
  root.current.rotation.y+=Math.min(delta,.034)*.09;
  root.current.rotation.x=THREE.MathUtils.lerp(root.current.rotation.x,Math.sin(time*.17)*.034+pointer.y*.035,.025);
  root.current.position.y=Math.sin(time*.38)*.048;
 });
 return <group ref={root} rotation={[.13,-.2,-.08]}>
  {curves.map((geometry,i)=><mesh geometry={geometry} key={i}>
   <meshBasicMaterial color={i%3===0?'#dc8e71':'#95c8cd'} transparent opacity={.72}/>
  </mesh>)}
  {nodes.map((node,i)=><group position={node.point} key={i}>
   <mesh position={[0,-.11,0]} rotation={[-Math.PI/2,0,0]}>
    <ringGeometry args={[.24,.3,36]}/><meshBasicMaterial color="#edf0db" transparent opacity={.5} side={THREE.DoubleSide}/>
   </mesh>
   <mesh position={[0,node.height*.4,0]}>
    <cylinderGeometry args={[.13,.18,node.height,8]}/>
    <meshStandardMaterial color={node.tint} metalness={.08} roughness={.56} flatShading/>
   </mesh>
   <mesh position={[0,node.height*.9,0]}>
    <sphereGeometry args={[.14,12,12]}/>
    <meshBasicMaterial color={node.tint}/>
   </mesh>
   <mesh position={[0,-.06,0]} rotation={[-Math.PI/2,0,0]}>
    <circleGeometry args={[.1,24]}/><meshBasicMaterial color="#f8f2dc" side={THREE.DoubleSide}/>
   </mesh>
  </group>)}
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.95,-.5]}>
   <torusGeometry args={[2.6,.006,5,92]}/><meshBasicMaterial color="#8db4c3" transparent opacity={.27}/>
  </mesh>
 </group>;
}

export default function OpportunityCanvas(){
 const [enabled,setEnabled]=useState(false);
 const [ready,setReady]=useState(false);
 const [reduced,setReduced]=useState(false);
 const [smallScreen,setSmallScreen]=useState(false);
 const canvasWrap=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
  const smallQuery=window.matchMedia('(max-width: 700px)');
  const update=()=>{setReduced(motionQuery.matches);setSmallScreen(smallQuery.matches);setReady(true);};
  update();
  motionQuery.addEventListener('change',update);
  smallQuery.addEventListener('change',update);
  const observer=new IntersectionObserver(entries=>setEnabled(Boolean(entries[0]?.isIntersecting)),{threshold:.08});
  if(canvasWrap.current)observer.observe(canvasWrap.current);
  const handleVisibility=()=>{if(document.hidden)setEnabled(false);else if(canvasWrap.current){setEnabled(canvasWrap.current.getBoundingClientRect().bottom>0);}};
  document.addEventListener('visibilitychange',handleVisibility);
  return ()=>{observer.disconnect();motionQuery.removeEventListener('change',update);smallQuery.removeEventListener('change',update);document.removeEventListener('visibilitychange',handleVisibility);};
 },[]);
 const active=enabled&&!reduced&&!smallScreen;
 return <div className="opportunity-canvas" ref={canvasWrap} aria-hidden="true">
  {(!ready||smallScreen||reduced)?<div className="atlas-fallback"><span className="atlas-rail rail-one"/><span className="atlas-rail rail-two"/><span className="atlas-rail rail-three"/>{[1,2,3,4].map(i=><span className={`atlas-pin pin-${i}`} key={i}/>)}</div>:
   <Canvas camera={{position:[0,.15,8.15],fov:41}} frameloop={active?'always':'demand'} dpr={[1,1.4]} gl={{alpha:true,antialias:true,powerPreference:'high-performance'}} fallback={<div className="atlas-fallback"/>}>
    <ambientLight intensity={2.7}/>
    <directionalLight position={[4,5,7]} intensity={2.4}/>
    <Atlas active={active}/>
   </Canvas>}
 </div>;
}

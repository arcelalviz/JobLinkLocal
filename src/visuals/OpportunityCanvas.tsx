'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Node={pos:[number,number,number];scale:number;color:string};
const points:Node[]=[
 {pos:[-2.6,1.5,.1],scale:.35,color:'#eaff86'},
 {pos:[-1.4,-.75,.7],scale:.24,color:'#a8f5de'},
 {pos:[-.1,1.05,1.4],scale:.6,color:'#ffb6a1'},
 {pos:[1.65,1.68,-.3],scale:.31,color:'#a5abff'},
 {pos:[2.35,-.65,.4],scale:.42,color:'#efffaa'},
 {pos:[.45,-1.55,-.25],scale:.22,color:'#74cdb7'}
];

function Connections(){
 const geometry=useMemo(()=>{
   const vertices:number[]=[];
   for(const [a,b] of [[0,1],[0,2],[1,2],[1,5],[2,3],[2,4],[3,4],[4,5]] as [number,number][]){
     const p=new THREE.Vector3(...points[a].pos);
     const q=new THREE.Vector3(...points[b].pos);
     const middle=p.clone().lerp(q,.5).add(new THREE.Vector3(0,.25,.15));
     const curve=new THREE.QuadraticBezierCurve3(p,middle,q);
     for(let i=0;i<34;i++){
       const first=curve.getPoint(i/34),second=curve.getPoint((i+1)/34);
       vertices.push(...first.toArray(),...second.toArray());
     }
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));return g;
 },[]);
 return <lineSegments geometry={geometry}><lineBasicMaterial color="#9cdfc2" transparent opacity={.47}/></lineSegments>;
}

function Sculpture({reduced}:{reduced:boolean}){
 const group=useRef<THREE.Group>(null);
 const core=useRef<THREE.Mesh>(null);
 useFrame(({clock,pointer})=>{
   if(!group.current || reduced)return;
   const t=clock.elapsedTime;
   group.current.rotation.y=t*.085+pointer.x*.12;
   group.current.rotation.x=Math.sin(t*.25)*.045-pointer.y*.05;
   if(core.current) core.current.rotation.set(t*.12,t*.20,t*.04);
 });
 return <group ref={group}>
  <Connections/>
  {points.map((n,i)=><Float key={i} speed={reduced?0:1.1+i*.2} rotationIntensity={reduced?0:.15} floatIntensity={reduced?0:.23}>
    <group position={n.pos}>
      <mesh scale={n.scale}><icosahedronGeometry args={[1,1]}/><meshPhysicalMaterial color={n.color} roughness={.16} metalness={.28} clearcoat={.8} flatShading/></mesh>
      <mesh scale={n.scale*1.25}><sphereGeometry args={[1,22,22]}/><meshBasicMaterial color={n.color} transparent opacity={.075} wireframe/></mesh>
    </group>
  </Float>)}
  <mesh ref={core} position={[0,0,0]} rotation={[.2,.3,.2]}>
    <torusKnotGeometry args={[1.0,.16,160,12,2,3]}/>
    <meshPhysicalMaterial color="#d5eeac" metalness={.38} roughness={.18} clearcoat={1} clearcoatRoughness={.16}/>
  </mesh>
  <mesh position={[0,0,0]} rotation={[1.1,0,.3]}><torusGeometry args={[1.64,.013,6,140]}/><meshBasicMaterial color="#f4f7cb" transparent opacity={.34}/></mesh>
 </group>;
}

export default function OpportunityCanvas(){
 const [reduced,setReduced]=useState(false);
 useEffect(()=>{
   const media=window.matchMedia('(prefers-reduced-motion: reduce)');
   const update=()=>setReduced(media.matches);
   update();media.addEventListener('change',update);
   return ()=>media.removeEventListener('change',update);
 },[]);
 return <div className="opportunity-canvas" aria-hidden="true">
 <Canvas camera={{position:[0,0,7.8],fov:43}} dpr={[1,1.5]} gl={{alpha:true,antialias:true,powerPreference:'low-power'}} fallback={<div className="canvas-fallback"/>}>
   <ambientLight intensity={2.1}/>
   <directionalLight position={[3,4,6]} intensity={3} color="#ffebcb"/>
   <pointLight position={[-5,-1,2]} intensity={30} color="#60d5c6" distance={10}/>
   <Sculpture reduced={reduced}/>
 </Canvas>
 </div>;
}

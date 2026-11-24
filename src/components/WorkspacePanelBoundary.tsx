'use client';
import { Component, type ReactNode, type ErrorInfo } from 'react';

type Props = {children: ReactNode; section: string};
export class WorkspacePanelBoundary extends Component<Props,{failed:boolean}> {
 state = {failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error,info:ErrorInfo){
  console.error('[JobLinkLocal panel]',{section:this.props.section,name:error.name,message:error.message,componentStack:info.componentStack});
 }
 render(){
  if(!this.state.failed)return this.props.children;
  return <div className="jl-data-error" role="alert"><span>This section could not be displayed. Other workspace sections are still available.</span><button type="button" className="btn btn-outline btn-small" onClick={()=>this.setState({failed:false})}>Retry section</button></div>;
 }
}

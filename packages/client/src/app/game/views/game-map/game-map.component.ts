import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { AcMapComponent, AcNotification, ViewerConfiguration, ActionType } from 'angular-cesium';
import { GameFields } from '../../../types';
import { Subject } from 'rxjs/Subject';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observer } from 'rxjs/Observer';

const matrix3Scratch = new Cesium.Matrix3();

enum MeModelState {
  WALKING,
  RUNNING,
  LYING,
  SHOOTING,
}

interface MeState {
  id: string;
  location: any; // Cesium.Cartesian3
  heading: number;
  state: MeModelState;
}

@Component({
  selector: 'game-map',
  templateUrl: './game-map.component.html',
  providers: [
    ViewerConfiguration,
  ],
  styleUrls: ['./game-map.component.scss']
})
export class GameMapComponent implements OnInit {
  @Input() private playersPositions: Observable<AcNotification>;
  @Input() private gameData: Observable<GameFields.Fragment>;
  @ViewChild(AcMapComponent) private mapInstance: AcMapComponent;

  private me$: BehaviorSubject<MeState> = new BehaviorSubject<MeState>(null);

  private viewer: any;

  constructor(private viewerConf: ViewerConfiguration) {
    viewerConf.viewerOptions = {
      selectionIndicator: false,
      timeline: false,
      infoBox: false,
      fullscreenButton: false,
      baseLayerPicker: false,
      animation: false,
      homeButton: false,
      geocoder: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      terrainProviderViewModels: [],
    };

    viewerConf.viewerModifier = (viewer) => {
      this.viewer = viewer;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.bottomContainer.remove();
      const screenSpaceCameraController = viewer.scene.screenSpaceCameraController;
      viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
      screenSpaceCameraController.enableTilt = false;
      screenSpaceCameraController.enableRotate = false;
      screenSpaceCameraController.enableZoom = false;
    };
  }

  get meNotifications$() {
    return this.me$.filter(f => f !== null).map(meState => ({
      actionType: ActionType.ADD_UPDATE,
      id: meState.id,
      entity: meState,
    }));
  }

  ngOnInit() {
    this.gameData.first().subscribe(value => {
      this.me$.next({
        id: 'me',
        location: this.getPosition(value.me.currentLocation.location),
        heading: value.me.currentLocation.heading,
        state: MeModelState.WALKING,
      });

      this.viewer.scene.preRender.addEventListener(this.preRenderHandler.bind(this));
    });
  }

  preRenderHandler() {
    const result = this.getModelMatrix(this.me$.getValue().location, this.me$.getValue().heading);
    this.viewer.camera.lookAtTransform(result, new Cesium.Cartesian3(0, 15, 5));
  }

  getPosition(location) {
    const { x, y, z } = location;

    return new Cesium.Cartesian3(x, y, z);
  }

  getOrientation(location, heading) {
    const headingC = Cesium.Math.toRadians(heading);
    const pitch = Cesium.Math.toRadians(0);
    const roll = Cesium.Math.toRadians(0);
    const hpr = new Cesium.HeadingPitchRoll(headingC, pitch, roll);

    return Cesium.Transforms.headingPitchRollQuaternion(this.getPosition(location), hpr);
  }

  getModelMatrix(location, heading) {
    const orientation = this.getOrientation(location, heading);

    if (!Cesium.defined(orientation)) {
      return Cesium.Transforms.eastNorthUpToFixedFrame(location, undefined, null);
    } else {
      return Cesium.Matrix4.fromRotationTranslation(Cesium.Matrix3.fromQuaternion(orientation, matrix3Scratch), location, null);
    }
  }

  getTilesMatrix() {
    return Cesium.Matrix4.fromTranslation(new Cesium.Cartesian3(0, 0, 0));
  }

  getHeightReference() {
    return Cesium.HeightReference.CLAMP_TO_GROUND;
  }
}

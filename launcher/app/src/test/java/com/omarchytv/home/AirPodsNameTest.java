package com.omarchytv.home;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class AirPodsNameTest {
    @Test
    public void dropsTheTrailingSuffix() {
        assertEquals("I Am Focused AirPods Pro", AirPods.clean("I Am Focused AirPods Pro  - Fin"));
        assertEquals("AirPods Pro", AirPods.clean("AirPods Pro"));
        assertEquals("Grant's AirPods Pro", AirPods.clean("Grant's AirPods Pro"));
    }
}
